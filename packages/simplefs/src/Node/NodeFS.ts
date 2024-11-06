import fs from 'fs/promises'

import { Errno, FSError } from '../model/FSError';
import { ISimpleFS, ListEntry, ListOptions } from '../model/ISimpleFS';
import { Path } from '../model/Path';

export class NodeFS implements ISimpleFS {
  private readonly _basePath: string;

  constructor(basePath: string) {
    if (!basePath.endsWith('/')) {
      basePath = basePath + '/';
    }
    this._basePath = basePath;
  }

  async fileExists(path: Path): Promise<boolean> {
    const physicalPath = this._basePath + path.value;
    try {
      const stat = await fs.stat(this._basePath + path.value);
      return stat.isFile();
    }
    catch (error) {
      if (isErrnoException(error) && error.code === 'ENOENT') {
        return false;
      }

      throw wrapFsError(error, physicalPath);
    }
  }
  async directoryExists(path: Path): Promise<boolean> {
    const physicalPath = this._basePath + path.value;
    try {
      const stat = await fs.stat(this._basePath + path.value);
      return stat.isDirectory();
    }
    catch (error) {
      if (isErrnoException(error) && error.code === 'ENOENT') {
        return false;
      }

      throw wrapFsError(error, physicalPath);
    }
  }

  async read(path: Path): Promise<Uint8Array> {
    const physicalPath = this._basePath + path.value;
    try {
      const data = await fs.readFile(physicalPath);
      return new Uint8Array(data.buffer);
    }
    catch (error) {
      throw wrapFsError(error, physicalPath);
    }
  }

  async write(path: Path, data: Uint8Array): Promise<void> {
    const physicalPath = this._basePath + path.value;
    try {
      // Ensure parent folder exists...
      if (!path.isRoot) {
        await fs.mkdir(this._basePath + path.getParent().value, { recursive: true });
      }

      await fs.writeFile(physicalPath, data);
    }
    catch (error) {
      throw wrapFsError(error, physicalPath);
    }
  }

  async deleteFile(path: Path): Promise<void> {
    const physicalPath = this._basePath + path;
    try {
      await fs.unlink(physicalPath);
    }
    catch (error) {
      throw wrapFsError(error, physicalPath);
    }
  }

  async deleteDirectory(path: Path): Promise<void> {
    const physicalPath = this._basePath + path;
    try {
      await fs.rmdir(physicalPath, { recursive: true });
    }
    catch (error) {
      throw wrapFsError(error, physicalPath);
    }
  }

  async createDirectory(path: Path): Promise<void> {
    const physicalPath = this._basePath + path.value;
    try {
      await fs.mkdir(this._basePath + path.value, { recursive: true });
    }
    catch (error) {
      throw wrapFsError(error, physicalPath);
    }
  }

  async list(path: Path, options?: ListOptions): Promise<ListEntry[]> {
    const physicalPath = this._basePath + path.value;
    const entries = await fs.readdir(physicalPath, {
      recursive: options?.recursive,
    });

    const result: ListEntry[] = [];
    for (const entry of entries) {
      const entryPath = Path.join(path, new Path(entry));
      const entryStat = await fs.stat(this._basePath + entryPath.value);
      result.push({
        path: entryPath,
        kind: entryStat.isFile() ? 'file' : 'dir',
      });
    }

    return result;
  }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function wrapFsError(error: unknown, physicalPath: string): FSError {
  if (isErrnoException(error) && error.code !== undefined) {
    const errorCode = error.code as keyof typeof Errno;
    if (errorCode in Errno) {
      throw new FSError(Errno[errorCode], physicalPath, `Unhandled error: ${error}`);
    }
  }

  throw new FSError(Errno.EIO, physicalPath, `Unhandled unknown error: ${error}`);
}