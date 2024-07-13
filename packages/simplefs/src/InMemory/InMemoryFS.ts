import { Errno, FSError } from "../model/FSError";
import { ISimpleFS, ListEntry, ListOptions } from "../model/ISimpleFS";
import { Path } from "../model/Path";

interface FileEntry {
  kind: 'file';
  path: Path;
  content: Uint8Array;
}
interface DirectoryEntry {
  kind: 'dir';
  path: Path;
}
type Entry = FileEntry | DirectoryEntry;

export class InMemoryFS implements ISimpleFS {
  private readonly _store = new Map<string, Entry>();

  async fileExists(path: Path): Promise<boolean> {
    const entry = this._store.get(path.value);
    return entry !== undefined && entry.kind === 'file';
  }
  async directoryExists(path: Path): Promise<boolean> {
    const entry = this._store.get(path.value);
    return entry !== undefined && entry.kind === 'dir';
  }

  async read(path: Path): Promise<Uint8Array> {
    const entry = this._store.get(path.value);
    if (entry === undefined) {
      throw new FSError(Errno.ENOENT, path.value);
    }

    if (entry.kind !== 'file') {
      throw new FSError(Errno.EISDIR, path.value);
    }

    return entry.content;
  }

  async write(path: Path, data: Uint8Array): Promise<void> {
    // Ensure parent folder exists...
    this.ensureParentExists(path);

    this._store.set(path.value, {
      kind: 'file',
      path: path,
      content: data,
    })
  }

  async deleteFile(path: Path): Promise<void> {
    const entry = this._store.get(path.value);
    if (entry === undefined) {
      throw new FSError(Errno.ENOENT, path.value);
    }

    if (entry.kind !== 'file') {
      throw new FSError(Errno.EISDIR, path.value);
    }

    this._store.delete(path.value);
  }

  async deleteDirectory(path: Path): Promise<void> {
    const entry = this._store.get(path.value);
    if (entry === undefined) {
      throw new FSError(Errno.ENOENT, path.value);
    }

    if (entry.kind !== 'dir') {
      throw new FSError(Errno.ENOTDIR, path.value);
    }

    const toDelete: string[] = [];
    for (const entry of this._store.values()) {
      if (entry.path.startsWith(path)) {
        toDelete.push(entry.path.value);
      }
    }

    for (const path of toDelete) {
      this._store.delete(path);
    }
  }

  async createDirectory(path: Path): Promise<void> {
    const entry = this._store.get(path.value);
    if (entry !== undefined) {
      throw new FSError(Errno.EEXIST, path.value);
    }

    this.ensureParentExists(path);
    this._store.set(path.value, {
      kind: 'dir',
      path: path,
    });
  }

  async list(path: Path, options?: ListOptions): Promise<ListEntry[]> {
    const results: ListEntry[] = [];
    const recursive = options?.recursive;

    if (!path.isRoot) {
      const entry = this._store.get(path.value);
      if (entry === undefined) {
        throw new FSError(Errno.ENOENT, path.value);
      }
      if (entry.kind !== 'dir') {
        throw new FSError(Errno.ENOTDIR, path.value);
      }
    }

    for (const entry of this._store.values()) {
      const isMatch =
        recursive
          ? path.isParentOf(entry.path)
          : path.isImmediateParentOf(entry.path);

      if (isMatch) {
        if (entry.kind === 'file') {
          results.push({ kind: 'file', path: entry.path });
        }
        else {
          results.push({ kind: 'dir', path: entry.path });
        }
      }
    }

    results.sort((a, b) => a.path.value.localeCompare(b.path.value));
    return results;
  }

  private ensureParentExists(path: Path) {
    const segments = path.segments;
    for (let i = 0; i < segments.length - 1; i++) {
      const segmentPath = segments.slice(0, i + 1).join('/');
      const entry = this._store.get(segmentPath);
      if (entry === undefined) {
        this._store.set(segmentPath, {
          kind: 'dir',
          path: new Path(segmentPath),
        });
      }
      else if (entry.kind !== 'dir') {
        throw new FSError(Errno.ENOTDIR, segmentPath);
      }
    }
  }
}
