import * as fflate from 'fflate';
import { ISimpleFS, Path } from '@forgsync/simplefs';

import { Hash, ReflogEntry } from './model';
import { decode, encode } from './encoding/util';
import { decodeReflog, encodeReflog } from './encoding/reflog';

export interface IRepo {
  listRefs(what: 'refs/heads' | 'refs/remotes'): Promise<string[]>;
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
  private readonly _fs: ISimpleFS;

  constructor(fs: ISimpleFS) {
    this._fs = fs;
  }

  async init() {
    const hasHeadFile = await this._fs.fileExists(new Path('HEAD'));
    const hasObjectsDir = await this._fs.directoryExists(new Path('objects'));
    const hasRefsDir = await this._fs.directoryExists(new Path('refs'));

    if (hasHeadFile && hasObjectsDir && hasRefsDir) {
      // All good!
      return;
    } else if (!hasHeadFile && !hasObjectsDir && !hasRefsDir) {
      await this._fs.write(new Path('HEAD'), encode('ref: refs/heads/main')); // NOTE: This is mostly useless in a bare repo, but git still requires it. See: https://stackoverflow.com/a/29296584
      await this._fs.createDirectory(new Path('objects'));
      await this._fs.createDirectory(new Path('refs'));
      if (!(await this._fs.fileExists(new Path('config')))) {
        await this._fs.write(new Path('config'), encode(getDefaultConfig()));
      }
    }
  }

  async listRefs(): Promise<string[]> {
    const refs: string[] = [];

    for (const node of await this._fs.list(new Path('refs'), { recursive: true })) {
      if (node.kind === 'file') {
        refs.push(node.path.value);
      }
    }

    //console.log(`Found refs: ${JSON.stringify(refs)}`);
    return refs;
  }

  async getRef(ref: string): Promise<string | undefined> {
    const path = new Path(ref);
    if (!(await this._fs.fileExists(path))) {
      return undefined;
    }

    // TODO: Handle not found as a special case. See: https://github.com/duna-oss/flystorage/issues/50
    const rawContent = await this._fs.read(path);
    const content = decode(rawContent);
    return content.trim();
  }

  async setRef(ref: string, hash: string | undefined): Promise<void> {
    const path = new Path(ref);
    if (hash !== undefined) {
      const rawContent = `${hash}\n`;
      const content = encode(rawContent);
      await this._fs.write(path, content);
    } else {
      await this._fs.deleteFile(path);
    }
  }

  async getReflog(ref: string): Promise<ReflogEntry[]> {
    const logPath = new Path(`logs/${ref}`);
    if (!(await this._fs.fileExists(logPath))) {
      return [];
    }

    // TODO: Handle not found as a special case. See: https://github.com/duna-oss/flystorage/issues/50
    const rawContent = await this._fs.read(logPath);
    return decodeReflog(rawContent);
  }

  async setReflog(ref: string, reflog: ReflogEntry[]): Promise<void> {
    const rawContent = encodeReflog(reflog);
    await this._fs.write(new Path(`logs/${ref}`), encode(rawContent));
  }

  async saveRawObject(hash: string, raw: Uint8Array): Promise<void> {
    const compressed = fflate.deflateSync(raw);
    const path = Repo._ObjectPath(hash);
    await this._fs.write(path, compressed);
  }

  async loadRawObject(hash: string): Promise<Uint8Array | undefined> {
    const path = Repo._ObjectPath(hash);

    // TODO: Handle not found properly and avoid the extra call that still allows for race conditions. See: https://github.com/duna-oss/flystorage/issues/50
    if (!(await this._fs.fileExists(path))) {
      return undefined;
    }

    const compressed = await this._fs.read(path);
    return compressed ? fflate.inflateSync(compressed) : undefined;
  }

  async hasObject(hash: string): Promise<boolean> {
    return await this._fs.fileExists(Repo._ObjectPath(hash));
  }

  async saveMetadata(name: string, value: Uint8Array | undefined): Promise<void> {
    const path = new Path(name);
    if (path.segments.length !== 1) {
      throw new Error(`Metadata files are only allowed at the root`);
    }

    if (value !== undefined) {
      await this._fs.write(path, value);
    } else {
      await this._fs.deleteFile(path);
    }
  }

  async loadMetadata(name: string): Promise<Uint8Array | undefined> {
    const path = new Path(name);
    if (path.segments.length !== 1) {
      throw new Error(`Metadata files are only allowed at the root`);
    }

    // TODO: Handle not found properly and avoid the extra call that still allows for race conditions. See: https://github.com/duna-oss/flystorage/issues/50
    if (!(await this._fs.fileExists(path))) {
      return undefined;
    }

    const content = await this._fs.read(path);
    return content;
  }

  private static _ObjectPath(hash: Hash) {
    return new Path(`objects/${hash.substring(0, 2)}/${hash.substring(2)}`);
  }
}

function getDefaultConfig(): string {
  const lines = [
    '# This is a FORG repo',
    '# Learn more: https://github.com/davidnx/forg',
    '#',
    '[core]',
    '\trepositoryformatversion = 0',
    '\tfilemode = false',
    '\tbare = true',
    '\tsymlinks = false',
    '',
    '[gc]',
    '\tauto = 0',
    '\treflogExpire = never',
    '\treflogExpireUnreachable = never',
    '',
    '[forg]',
    '\tversion = 1',
    '',
  ];

  return lines.join('\n');
}
