import { Errno, FSError, ISimpleFS, ListEntry, ListOptions, Path } from "@forgsync/simplefs";
import { IRepo, loadBlobObject, loadTreeObject, Mode, ModeHash, TreeBody } from "../git";
import { isFile } from "../git/util";

export class GitTreeFS implements ISimpleFS {
  constructor(
    private readonly _repo: IRepo,
    private readonly _tree: TreeBody,
  ) { }

  async fileExists(path: Path): Promise<boolean> {
    let entry: ModeHash;
    try {
      entry = await this._findEntry(path);
    } catch (error) {
      if (error instanceof FSError && error.errno === Errno.ENOENT) {
        return false;
      }

      throw error;
    }

    if (!isFile(entry.mode)) {
      throw new FSError(Errno.EISDIR, path.value);
    }

    return true;
  }

  async directoryExists(path: Path): Promise<boolean> {
    if (path.isRoot) {
      // Special case, root always exists
      return true;
    }

    let entry: ModeHash;
    try {
      entry = await this._findEntry(path);
    } catch (error) {
      if (error instanceof FSError && error.errno === Errno.ENOENT) {
        return false;
      }

      throw error;
    }

    if (isFile(entry.mode)) {
      throw new FSError(Errno.ENOTDIR, path.value);
    }

    return true;
  }

  async read(path: Path): Promise<Uint8Array> {
    const entry = await this._findEntry(path);

    if (!isFile(entry.mode)) {
      throw new FSError(Errno.EISDIR, path.value);
    }

    const result = await loadBlobObject(this._repo, entry.hash);
    if (result === undefined) {
      throw new FSError(Errno.EIO, path.value);
    }

    return result.body;
  }

  async list(path: Path, options?: ListOptions): Promise<ListEntry[]> {
    const tree = await this._findTree(path);
    const recursive = options?.recursive;
    if (recursive) {
      throw new Error('Recursive is not implemented for GitTreeFS');
    }

    const result: ListEntry[] = [];
    for (const name in tree) {
      const entry = tree[name];
      result.push({
        kind: isFile(entry.mode) ? 'file' : 'dir',
        path: Path.join(path, new Path(name)),
      });
    }

    return result;
  }

  write(path: Path, _data: Uint8Array): Promise<void> {
    throw new FSError(Errno.EROFS, path.value);
  }

  deleteFile(path: Path): Promise<void> {
    throw new FSError(Errno.EROFS, path.value);
  }

  createDirectory(path: Path): Promise<void> {
    throw new FSError(Errno.EROFS, path.value);
  }

  deleteDirectory(path: Path): Promise<void> {
    throw new FSError(Errno.EROFS, path.value);
  }

  private async _findTree(path: Path): Promise<TreeBody> {
    let tree = this._tree;
    const segments = path.segments;
    for (let i = 0; i < segments.length; i++) {
      const entry = tree[segments[i]];
      if (entry === undefined) {
        throw new FSError(Errno.ENOENT, path.value);
      }

      if (entry.mode !== Mode.tree) {
        throw new FSError(Errno.ENOTDIR, path.value);
      }

      const treeObj = await loadTreeObject(this._repo, entry.hash);
      if (treeObj === undefined) {
        throw new FSError(Errno.EIO, path.value);
      }

      tree = treeObj.body;
    }

    return tree;
  }

  private async _findEntry(path: Path): Promise<ModeHash> {
    if (path.isRoot) {
      throw new FSError(Errno.EINVAL, path.value);
    }

    const tree = await this._findTree(path.getParent());
    const segments = path.segments;
    const entry = tree[segments[segments.length - 1]];
    if (entry === undefined) {
      throw new FSError(Errno.ENOENT, path.value);
    }

    return entry;
  }
}