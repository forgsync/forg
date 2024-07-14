import { Errno, FSError, ISimpleFS, ListEntry, ListOptions, Path } from "@forgsync/simplefs";
import { IRepo, loadBlobObject, loadTreeObject } from "../git";
import { ExpandedTree, treeToWorkingTree, WorkingTreeFile, WorkingTreeFolder } from "../git/workingTree";

export class GitTreeFS implements ISimpleFS {
  constructor(
    private readonly _repo: IRepo,
    private readonly _tree: ExpandedTree,
  ) { }

  async fileExists(path: Path): Promise<boolean> {
    try {
      await this._findFileEntry(path);
    } catch (error) {
      if (error instanceof FSError && error.errno === Errno.ENOENT) {
        return false;
      }

      throw error;
    }

    return true;
  }

  async directoryExists(path: Path): Promise<boolean> {
    if (path.isRoot) {
      // Special case, root always exists
      return true;
    }

    try {
      await this._findFolderEntry(path);
    } catch (error) {
      if (error instanceof FSError && error.errno === Errno.ENOENT) {
        return false;
      }

      throw error;
    }

    return true;
  }

  async read(path: Path): Promise<Uint8Array> {
    const entry = await this._findFileEntry(path);
    if ('hash' in entry) {
      const result = await loadBlobObject(this._repo, entry.hash);
      if (result === undefined) {
        throw new FSError(Errno.EIO, path.value);
      }
      return result.body;
    } else {
      return entry.body;
    }
  }

  async list(path: Path, options?: ListOptions): Promise<ListEntry[]> {
    const tree = await this._findTree(path);
    const recursive = options?.recursive;
    if (recursive) {
      throw new Error('Recursive is not implemented for GitTreeFS');
    }

    const result: ListEntry[] = [];
    for (const name in tree.entries) {
      const entry = tree.entries[name];
      result.push({
        kind: entry.type === 'tree' ? 'dir' : 'file',
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

  private async _findFileEntry(path: Path): Promise<WorkingTreeFile> {
    if (path.isRoot) {
      throw new FSError(Errno.EINVAL, path.value);
    }

    const tree = await this._findTree(path.getParent());
    const entry = tree.entries[path.leafName];
    if (entry === undefined) {
      throw new FSError(Errno.ENOENT, path.value);
    } else if (entry.type !== 'file') {
      throw new FSError(Errno.EISDIR, path.value);
    }

    return entry;
  }

  private async _findFolderEntry(path: Path): Promise<WorkingTreeFolder> {
    if (path.isRoot) {
      throw new FSError(Errno.EINVAL, path.value);
    }

    const tree = await this._findTree(path.getParent());
    const entry = tree.entries[path.leafName];
    if (entry === undefined) {
      throw new FSError(Errno.ENOENT, path.value);
    }
    else if (entry.type !== 'tree') {
      throw new FSError(Errno.ENOTDIR, path.value);
    }

    return entry;
  }

  private async _findTree(path: Path): Promise<ExpandedTree> {
    let tree = this._tree;
    const segments = path.segments;
    for (let i = 0; i < segments.length; i++) {
      tree = await this._expandChildFolder(tree, segments[i], path);
    }

    return tree;
  }

  private async _expandChildFolder(folder: ExpandedTree, childName: string, path: Path): Promise<ExpandedTree> {
    const item = folder.entries[childName];
    if (item === undefined) {
      throw new FSError(Errno.ENOENT, path.value);
    } else if (item.type !== 'tree') {
      throw new FSError(Errno.ENOTDIR, path.value);
    }

    if ('hash' in item) {
      const treeObject = await loadTreeObject(this._repo, item.hash);
      if (treeObject === undefined) {
        throw new Error();
      }
      const expandedFolder = treeToWorkingTree(treeObject.body);
      folder.entries[childName] = expandedFolder;
      return expandedFolder;
    }
    else {
      return item;
    }
  }
}
