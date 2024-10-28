import * as fflate from 'fflate';
import { Errno, FSError, ISimpleFS, Path } from '@forgsync/simplefs';

import { Hash, ReflogEntry } from './model';
import { decode, encode } from './encoding/util';
import { decodeReflog, encodeReflog } from './encoding/reflog';
import { MissingObjectError } from './errors';

export type IRepo = IReadOnlyRepo & IWriteOnlyRepo;
export interface IReadOnlyRepo {
  listRefs(what: 'refs/heads' | 'refs/remotes'): Promise<string[]>;
  getRef(ref: string): Promise<Hash | undefined>;
  getReflog(ref: string): Promise<ReflogEntry[]>;
  loadRawObject(hash: Hash): Promise<Uint8Array>;
  hasObject(hash: Hash): Promise<boolean>;
  loadMetadata(name: string): Promise<Uint8Array | undefined>;
}
interface IWriteOnlyRepo {
  setRef(ref: string, hash: Hash | undefined): Promise<void>;
  setReflog(ref: string, reflog: ReflogEntry[]): Promise<void>;
  saveRawObject(hash: Hash, raw: Uint8Array): Promise<void>;
  deleteObject(hash: Hash): Promise<void>;
  saveMetadata(name: string, value: Uint8Array | undefined): Promise<void>;
}

export class Repo implements IRepo {
  private readonly _fs: ISimpleFS;
  private _initialized: boolean = false;

  constructor(fs: ISimpleFS) {
    this._fs = fs;
  }

  async init() {
    const hasHeadFile = await this._fs.fileExists(new Path('HEAD'));
    const hasObjectsDir = await this._fs.directoryExists(new Path('objects'));
    const hasRefsDir = await this._fs.directoryExists(new Path('refs'));
    const hasConfigFile = await this._fs.fileExists(new Path('config'));

    if (hasHeadFile && hasObjectsDir && hasRefsDir && hasConfigFile) {
      // TODO: Check that config file specifies `forg.version` === 1

      // All good!
      this._initialized = true;
      return;
    } else if (!hasHeadFile && !hasObjectsDir && !hasRefsDir && !hasConfigFile) {
      await this._fs.write(new Path('HEAD'), encode('ref: refs/heads/main')); // NOTE: This is mostly useless in a bare repo, but git still requires it. See: https://stackoverflow.com/a/29296584
      await this._fs.createDirectory(new Path('objects'));
      await this._fs.createDirectory(new Path('refs'));
      await this._fs.write(new Path('config'), encode(getDefaultConfig()));
      this._initialized = true;
    }
    else {
      // TODO: Make repo init idempotent in case a previous attempt failed halfway through and no other changes were made since.
      throw new Error('Repo is partially initialized. Delete first and try again or fix manually');
    }
  }

  async listRefs(what: 'refs/heads' | 'refs/remotes'): Promise<string[]> {
    this._ensureInitialized();

    const refs: string[] = [];
    try {
      for (const node of await this._fs.list(new Path(what), { recursive: true })) {
        if (node.kind === 'file') {
          refs.push(node.path.value);
        }
      }
    }
    catch (error) {
      if (error instanceof FSError && error.errno === Errno.ENOENT) {
        return [];
      }

      throw error;
    }

    //console.log(`Found refs: ${JSON.stringify(refs)}`);
    return refs;
  }

  async getRef(ref: string): Promise<string | undefined> {
    this._ensureInitialized();

    const path = getRefPath(ref);
    let rawContent: Uint8Array;
    try {
      rawContent = await this._fs.read(path);
    } catch (error) {
      if (error instanceof FSError) {
        if (error.errno === Errno.ENOENT) {
          return undefined;
        }
      }

      throw error;
    }

    const content = decode(rawContent);
    return content.trim();
  }

  async setRef(ref: string, hash: string | undefined): Promise<void> {
    this._ensureInitialized();

    const path = getRefPath(ref);
    if (hash !== undefined) {
      const rawContent = `${hash}\n`;
      const content = encode(rawContent);
      await this._fs.write(path, content);
    } else {
      await this._fs.deleteFile(path);
    }
  }

  async getReflog(ref: string): Promise<ReflogEntry[]> {
    this._ensureInitialized();

    const logPath = Path.join(new Path('logs'), getRefPath(ref));
    let rawContent: Uint8Array;
    try {
      rawContent = await this._fs.read(logPath);
    } catch (error) {
      if (error instanceof FSError) {
        if (error.errno === Errno.ENOENT) {
          return [];
        }
      }

      throw error;
    }

    return decodeReflog(rawContent);
  }

  async setReflog(ref: string, reflog: ReflogEntry[]): Promise<void> {
    this._ensureInitialized();

    const logPath = Path.join(new Path('logs'), getRefPath(ref));
    const rawContent = encodeReflog(reflog);
    await this._fs.write(logPath, encode(rawContent));
  }

  async saveRawObject(hash: string, raw: Uint8Array): Promise<void> {
    this._ensureInitialized();

    const compressed = fflate.deflateSync(raw);
    const path = computeObjectPath(hash);
    await this._fs.write(path, compressed);
  }

  async deleteObject(hash: string): Promise<void> {
    const path = computeObjectPath(hash);
    try {
      await this._fs.deleteFile(path);
    } catch (error) {
      if (error instanceof FSError) {
        if (error.errno === Errno.ENOENT) {
          return;
        }
      }

      throw error;
    }
  }

  async loadRawObject(hash: string): Promise<Uint8Array> {
    this._ensureInitialized();

    const path = computeObjectPath(hash);
    let rawContent: Uint8Array;
    try {
      rawContent = await this._fs.read(path);
    } catch (error) {
      if (error instanceof FSError) {
        if (error.errno === Errno.ENOENT) {
          throw new MissingObjectError(hash);
        }
      }

      throw error;
    }

    return fflate.inflateSync(rawContent);
  }

  async hasObject(hash: string): Promise<boolean> {
    this._ensureInitialized();
    return await this._fs.fileExists(computeObjectPath(hash));
  }

  async saveMetadata(name: string, value: Uint8Array | undefined): Promise<void> {
    this._ensureInitialized();

    const path = new Path(name);
    if (path.numSegments !== 1) {
      throw new Error(`Metadata files are only allowed at the root`);
    }

    if (value !== undefined) {
      await this._fs.write(path, value);
    } else {
      await this._fs.deleteFile(path);
    }
  }

  async loadMetadata(name: string): Promise<Uint8Array | undefined> {
    this._ensureInitialized();

    const path = new Path(name);
    if (path.numSegments !== 1) {
      throw new Error(`Metadata files are only allowed at the root`);
    }

    let rawContent: Uint8Array;
    try {
      rawContent = await this._fs.read(path);
    } catch (error) {
      if (error instanceof FSError) {
        if (error.errno === Errno.ENOENT) {
          return undefined;
        }
      }

      throw error;
    }

    return rawContent;
  }

  private _ensureInitialized() {
    if (!this._initialized) {
      throw new Error('Repo is not initialized');
    }
  }
}

function getDefaultConfig(): string {
  const lines = [
    '# This is a FORG repo',
    '# Learn more: https://github.com/forgsync/forg',
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

function computeObjectPath(hash: Hash): Path {
  return new Path(`objects/${hash.substring(0, 2)}/${hash.substring(2)}`);
}

function getRefPath(ref: string): Path {
  let path: Path | undefined = undefined;
  try {
    path = new Path(ref);
  } catch { }

  if (path === undefined || !path.startsWith(new Path('refs'))) {
    throw new Error(`Invalid ref '${ref}'`);
  }

  return path;
}
