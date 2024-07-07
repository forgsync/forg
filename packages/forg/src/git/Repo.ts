import * as fflate from 'fflate';
import { FileStorage } from "@flystorage/file-storage";

import { Hash, ReflogEntry } from './model';
import { decode, encode } from './encoding/util';
import { decodeReflog, encodeReflog } from './encoding/reflog';

export interface IRepo {
  listRefs(what: "refs/heads" | "refs/remotes"): Promise<string[]>;
  getRef(ref: string): Promise<Hash | undefined>;
  setRef(ref: string, hash: Hash | undefined): Promise<void>;
  getReflog(ref: string): Promise<ReflogEntry[]>;
  setReflog(ref: string, reflog: ReflogEntry[]): Promise<void>;
  saveRawObject(hash: Hash, raw: Uint8Array): Promise<void>;
  loadRawObject(hash: Hash): Promise<Uint8Array | undefined>;
  hasObject(hash: Hash): Promise<boolean>;
  saveMetadata(name: string, value: Uint8Array | undefined): Promise<void>;
  loadMetadata(name: string): Promise<Uint8Array | undefined>;
}

export class Repo implements IRepo {
  private readonly _fs: FileStorage;

  constructor(fs: FileStorage) {
    this._fs = fs;
  }

  async init() {
    const hasHeadFile = await this._fs.fileExists('HEAD');
    const hasObjectsDir = await this._fs.directoryExists('objects');
    const hasRefsDir = await this._fs.directoryExists('refs');

    if (hasHeadFile && hasObjectsDir && hasRefsDir) {
      // All good!
      return;
    }
    else if (!hasHeadFile && !hasObjectsDir && !hasRefsDir) {
      await this._fs.write("HEAD", "ref: refs/heads/main"); // NOTE: This is mostly useless in a bare repo, but git still requires it. See: https://stackoverflow.com/a/29296584
      await this._fs.createDirectory("objects");
      await this._fs.createDirectory("refs");
      if (!await this._fs.fileExists("config")) {
        await this._fs.write("config", getDefaultConfig());
      }
    }
  }

  async listRefs(what: "refs/heads" | "refs/remotes"): Promise<string[]> {
    const refs: string[] = [];
    // TODO: Handle baseBath does not exist and return empty set, don't throw...
    await this.listRefsCore(what, refs);
    return refs;
  }

  async getRef(ref: string): Promise<string | undefined> {
    if (!await this._fs.fileExists(ref)) {
      return undefined;
    }

    // TODO: Handle not found as a special case. See: https://github.com/duna-oss/flystorage/issues/50
    const rawContent = await this._fs.readToUint8Array(ref);
    const content = decode(rawContent);
    return content.trim();
  }

  async setRef(ref: string, hash: string | undefined): Promise<void> {
    if (hash !== undefined) {
      const rawContent = `${hash}\n`;
      const content = encode(rawContent);
      await this._fs.write(ref, content);
    }
    else {
      await this._fs.deleteFile(ref);
    }
  }

  async getReflog(ref: string): Promise<ReflogEntry[]> {
    const logPath = `logs/${ref}`;
    if (!await this._fs.fileExists(logPath)) {
      return [];
    }

    // TODO: Handle not found as a special case. See: https://github.com/duna-oss/flystorage/issues/50
    const rawContent = await this._fs.readToUint8Array(logPath);
    return decodeReflog(rawContent);
  }

  async setReflog(ref: string, reflog: ReflogEntry[]): Promise<void> {
    const rawContent = encodeReflog(reflog);
    await this._fs.write(`logs/${ref}`, rawContent);
  }

  async saveRawObject(hash: string, raw: Uint8Array): Promise<void> {
    const compressed = fflate.deflateSync(raw);
    const path = Repo._ObjectPath(hash);
    await this._fs.write(path, compressed);
  }

  async loadRawObject(hash: string): Promise<Uint8Array | undefined> {
    const path = Repo._ObjectPath(hash);

    // TODO: Handle not found as a special case. See: https://github.com/duna-oss/flystorage/issues/50
    const compressed = await this._fs.readToUint8Array(path);
    return compressed ? fflate.inflateSync(compressed) : undefined;
  }

  async hasObject(hash: string): Promise<boolean> {
    return await this._fs.fileExists(Repo._ObjectPath(hash));
  }

  async saveMetadata(name: string, value: Uint8Array | undefined): Promise<void> {
    if (value !== undefined) {
      await this._fs.write(name, value);
    }
    else {
      await this._fs.deleteFile(name);
    }
  }

  async loadMetadata(name: string): Promise<Uint8Array | undefined> {
    // TODO: Handle not found as a special case. See: https://github.com/duna-oss/flystorage/issues/50
    const content = await this._fs.readToUint8Array(name);
    return content;
  }

  private async listRefsCore(basePath: string, refs: string[]): Promise<void> {
    const folders: string[] = [];
    for await (const ref of this._fs.list(basePath)) {
      if (ref.isFile) {
        refs.push(ref.path);
      }
      else {
        folders.push(ref.path);
      }
    }

    for (const folder of folders) {
      await this.listRefsCore(folder, refs);
    }
  }

  private static _ObjectPath(hash: Hash) {
    return `objects/${hash.substring(0, 2)}/${hash.substring(2)}`;
  }
}

function getDefaultConfig(): string {
  const lines = [
    "# This is a FORG repo",
    "# Learn more: https://github.com/davidnx/forg",
    "#",
    "[core]",
    "\trepositoryformatversion = 0",
    "\tfilemode = false",
    "\tbare = true",
    "\tsymlinks = false",
    "",
    "[gc]",
    "\tauto = 0",
    "\treflogExpire = never",
    "\treflogExpireUnreachable = never",
    "",
    "[forg]",
    "\tversion = 1",
    "",
  ];

  return lines.join("\n");
}
