import { Errno, FSError, ISimpleFS, ListEntry, ListOptions, Path } from "@forgsync/simplefs";
import { Hash, IRepo, loadBlobObject, loadTreeObject, MissingObjectError, saveObject, TreeObject, Type } from "../../git";
import { ExpandedTree, treeToWorkingTree, WorkingTreeFile, WorkingTreeFolder } from "../../git";

export class GitTreeFS implements ISimpleFS {
  private _modified: boolean = false;

  private constructor(
    private readonly _repo: IRepo,
    private readonly _root: ExpandedTree,
  ) { }

  get modified() { return this._modified; }
  get root() { return this._root; }

  /**
   * Initializes a GitTreeFS from a git Tree object.
   * This is usually used to create a filesystem interface on top of an existing git commit tree.
   */
  static fromTree(repo: IRepo, tree: TreeObject) {
    const root = treeToWorkingTree(tree.body);
    return new GitTreeFS(repo, root);
  }

  /**
   * Initializes a GitTreeFS from an in-memory representation of a working tree.
   * This is usually used to create a filesystem interface for a new tree that will be later committed to git.
   */
  static fromWorkingTree(repo: IRepo, root: ExpandedTree) {
    return new GitTreeFS(repo, root);
  }

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
      try {
        const result = await loadBlobObject(this._repo, entry.hash);
        return result.body;
      } catch (error) {
        if (error instanceof MissingObjectError) {
          throw new FSError(Errno.EIO, path.value, `Unable to find blob object '${entry.hash}' corresponding to working tree path '${path.value}'`);
        }

        const innerError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        throw new FSError(Errno.EIO, path.value, `Error while reading blob object '${entry.hash}' corresponding to working tree path '${path.value}': ${innerError}`);
      }
    } else {
      return entry.body;
    }
  }

  async list(path: Path, options?: ListOptions): Promise<ListEntry[]> {
    const tree = await this._findTree(path, false);
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

  async write(path: Path, data: Uint8Array): Promise<void> {
    const parentTree = await this._findParentFolder(path, true);
    const entry = parentTree.entries[path.leafName];
    if (entry !== undefined && entry.type !== 'file') {
      throw new FSError(Errno.EISDIR, path.value);
    }

    let fileHash: Hash;
    try {
      fileHash = await saveObject(this._repo, {
        type: Type.blob,
        body: data,
      });
    } catch (error) {
      const innerError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      throw new FSError(Errno.EIO, path.value, `Error while saving blob object corresponding to working tree path '${path.value}': ${innerError}`);
    }

    parentTree.entries[path.leafName] = {
      type: 'file',
      hash: fileHash,
    };
    this._modified = true;
  }

  async deleteFile(path: Path): Promise<void> {
    const parentTree = await this._findParentFolder(path, false);
    const entry = parentTree.entries[path.leafName];
    if (entry === undefined) {
      throw new FSError(Errno.ENOENT, path.value);
    }
    else if (entry.type !== 'file') {
      throw new FSError(Errno.EISDIR, path.value);
    }

    delete parentTree.entries[path.leafName];
    this._modified = true;
  }

  async createDirectory(path: Path): Promise<void> {
    const parent = await this._findTree(path.getParent(), true);
    const entry = parent.entries[path.leafName];
    if (entry !== undefined) {
      throw new FSError(Errno.EEXIST, path.value);
    }

    parent.entries[path.leafName] = {
      type: 'tree',
      entries: {},
    };
    this._modified = true;
  }

  async deleteDirectory(path: Path): Promise<void> {
    const parentTree = await this._findParentFolder(path, false);
    const entry = parentTree.entries[path.leafName];
    if (entry === undefined) {
      throw new FSError(Errno.ENOENT, path.value);
    }
    else if (entry.type !== 'tree') {
      throw new FSError(Errno.ENOTDIR, path.value);
    }

    delete parentTree.entries[path.leafName];
    this._modified = true;
  }

  private async _findFileEntry(path: Path): Promise<WorkingTreeFile> {
    const tree = await this._findParentFolder(path, false);
    const entry = tree.entries[path.leafName];
    if (entry === undefined) {
      throw new FSError(Errno.ENOENT, path.value);
    } else if (entry.type !== 'file') {
      throw new FSError(Errno.EISDIR, path.value);
    }

    return entry;
  }

  private async _findFolderEntry(path: Path): Promise<WorkingTreeFolder> {
    const tree = await this._findParentFolder(path, false);
    const entry = tree.entries[path.leafName];
    if (entry === undefined) {
      throw new FSError(Errno.ENOENT, path.value);
    }
    else if (entry.type !== 'tree') {
      throw new FSError(Errno.ENOTDIR, path.value);
    }

    return entry;
  }

  private async _findParentFolder(path: Path, createIfNotExists: boolean): Promise<ExpandedTree> {
    if (path.isRoot) {
      throw new FSError(Errno.EINVAL, path.value);
    }

    const tree = await this._findTree(path.getParent(), createIfNotExists);
    return tree;
  }

  private async _findTree(path: Path, createIfNotExists: boolean): Promise<ExpandedTree> {
    let tree = this._root;
    const segments = path.segments;
    for (let i = 0; i < segments.length; i++) {
      tree = await this._expandChildFolder(tree, segments[i], createIfNotExists, path);
    }

    return tree;
  }

  private async _expandChildFolder(folder: ExpandedTree, childName: string, createIfNotExists: boolean, path: Path): Promise<ExpandedTree> {
    const item = folder.entries[childName];
    if (item === undefined) {
      if (createIfNotExists) {
        const newItem: ExpandedTree = {
          type: 'tree',
          entries: {},
        };
        folder.entries[childName] = newItem;
        this._modified = true;
        return newItem;
      }
      else {
        throw new FSError(Errno.ENOENT, path.value);
      }
    } else if (item.type !== 'tree') {
      throw new FSError(Errno.ENOTDIR, path.value);
    }

    if ('hash' in item) {
      let treeObject: TreeObject;
      try {
        treeObject = await loadTreeObject(this._repo, item.hash);
      } catch (error) {
        if (error instanceof MissingObjectError) {
          throw new FSError(Errno.EIO, path.value, `Unable to find tree object '${item.hash}' corresponding to a part of working tree path '${path.value}'`);
        }

        const innerError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        throw new FSError(Errno.EIO, path.value, `Error while loading tree object '${item.hash}' corresponding to a part of working tree path '${path.value}': ${innerError}`);
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
