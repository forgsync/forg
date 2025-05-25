import { Errno, FSError, ISimpleFS, ListEntry, ListOptions, Path } from '@forgsync/simplefs';
import { IRepo } from './Repo';
import { ExpandedTree, expandSubTree, saveWorkingTree, treeToWorkingTree, WorkingTreeEntry, WorkingTreeFile, WorkingTreeFolder } from './workingTree';
import { loadBlobObject, saveObject, TreeObject } from './objects';
import { GitDbErrno, GitDbError } from './errors';
import { Hash, Type } from './model';
import { errorToString } from './util';

/**
 * An implementation of ISimpleFS with a git tree as the backend.
 */
export class GitTreeFS implements ISimpleFS {
  private _isModified = false;
  private _isMissingObjects = false;

  private constructor(
    private readonly _repo: IRepo,
    private readonly _root: ExpandedTree,
  ) { }

  get repo() { return this._repo; }

  /**
   * Whether the tree has been modified since this object was created or last saved.
   * This is reset to false each time the tree is saved by calling `save`.
   */
  get isModified() { return this._isModified; }
  get isMissingObjects() { return this._isMissingObjects; }
  get root() { return this._root; }
  get hash(): Hash {
    if (this._isModified) {
      throw new Error('Hash has not been computed after the tree was modified, call save first');
    }

    if (this._root.originalHash === undefined) {
      throw new Error('Root hash had not been computed yet, use a real git tree root or call save first');
    }

    return this._root.originalHash;
  }

  /**
   * Initializes a GitTreeFS from a git Tree object.
   * This is usually used to create a filesystem interface on top of an existing git commit tree.
   */
  static fromTree(repo: IRepo, tree: TreeObject, hash: Hash) {
    const root = treeToWorkingTree(tree.body, hash);
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
        if (error instanceof GitDbError && error.errno === GitDbErrno.MissingObject) {
          this._isMissingObjects = true;
          throw new FSError(Errno.EIO, path.value, `Unable to find blob object '${entry.hash}' corresponding to working tree path '${path.value}'`);
        }

        throw new FSError(Errno.EIO, path.value, `Error while reading blob object '${entry.hash}' corresponding to working tree path '${path.value}': ${errorToString(error)}`);
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
    for (const [name, entry] of tree.entries) {
      result.push({
        kind: entry.type === 'tree' ? 'dir' : 'file',
        path: Path.join(path, new Path(name)),
      });
    }

    return result;
  }

  async write(path: Path, data: Uint8Array): Promise<void> {
    const parentTree = await this._findParentFolder(path, true);
    const entry = parentTree.entries.get(path.leafName);
    if (entry !== undefined && entry.type !== 'file') {
      throw new FSError(Errno.EISDIR, path.value);
    }

    let fileHash: Hash;
    try {
      // TODO: Check if file exists first, then we wouldn't need to overwrite (depending on something analogous to consistency mode when syncing)
      fileHash = await saveObject(this._repo, {
        type: Type.blob,
        body: data,
      });
    } catch (error) {
      throw new FSError(Errno.EIO, path.value, `Error while saving blob object corresponding to working tree path '${path.value}': ${errorToString(error)}`);
    }

    parentTree.entries.set(path.leafName, {
      type: 'file',
      hash: fileHash,
    });
    this._isModified = true;
  }

  async deleteFile(path: Path): Promise<void> {
    const parentTree = await this._findParentFolder(path, false);
    const entry = parentTree.entries.get(path.leafName);
    if (entry === undefined) {
      throw new FSError(Errno.ENOENT, path.value);
    } else if (entry.type !== 'file') {
      throw new FSError(Errno.EISDIR, path.value);
    }

    parentTree.entries.delete(path.leafName);
    this._isModified = true;
  }

  async createDirectory(path: Path): Promise<void> {
    const parent = await this._findTree(path.getParent(), true);
    const entry = parent.entries.get(path.leafName);
    if (entry !== undefined) {
      throw new FSError(Errno.EEXIST, path.value);
    }

    parent.entries.set(path.leafName, {
      type: 'tree',
      entries: new Map(),
    });
    this._isModified = true;
  }

  async deleteDirectory(path: Path): Promise<void> {
    const parentTree = await this._findParentFolder(path, false);
    const entry = parentTree.entries.get(path.leafName);
    if (entry === undefined) {
      throw new FSError(Errno.ENOENT, path.value);
    } else if (entry.type !== 'tree') {
      throw new FSError(Errno.ENOTDIR, path.value);
    }

    parentTree.entries.delete(path.leafName);
    this._isModified = true;
  }

  async chroot(path: Path): Promise<GitTreeFS> {
    const folder = await this._findTree(path, false);
    const result = GitTreeFS.fromWorkingTree(this._repo, folder);
    result._isModified = this._isModified; // We could be a bit smarter and determine if this specific subtree was modified or not, but we don't need to be that precise. Worst case we'll say it's modified when it isn't.
    return result;
  }

  async save(): Promise<void> {
    await saveWorkingTree(this._repo, this._root);
    this._isModified = false;
  }

  async tryFindEntry(path: Path): Promise<WorkingTreeEntry | undefined> {
    if (path.isRoot) {
      return this._root;
    }

    const tree = await this._findParentFolder(path, false);
    const entry = tree.entries.get(path.leafName);
    return entry;
  }

  private async _findFileEntry(path: Path): Promise<WorkingTreeFile> {
    const entry = await this.tryFindEntry(path);
    if (entry === undefined) {
      throw new FSError(Errno.ENOENT, path.value);
    } else if (entry.type !== 'file') {
      throw new FSError(Errno.EISDIR, path.value);
    }

    return entry;
  }

  private async _findFolderEntry(path: Path): Promise<WorkingTreeFolder> {
    const entry = await this.tryFindEntry(path);
    if (entry === undefined) {
      throw new FSError(Errno.ENOENT, path.value);
    } else if (entry.type !== 'tree') {
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
    for (let i = 0; i < path.numSegments; i++) {
      tree = await this._expandChildFolder(tree, path, i, createIfNotExists);
    }

    return tree;
  }

  private async _expandChildFolder(folder: ExpandedTree, path: Path, segmentIndex: number, createIfNotExists: boolean): Promise<ExpandedTree> {
    const childName = path.segmentAt(segmentIndex);

    try {
      return await expandSubTree(this.repo, folder, childName);
    } catch (error) {
      if (error instanceof GitDbError) {
        if (error.errno === GitDbErrno.TreeEntryNotFound) {
          if (createIfNotExists) {
            const newItem: ExpandedTree = {
              type: 'tree',
              entries: new Map(),
            };
            folder.entries.set(childName, newItem);
            this._isModified = true;
            return newItem;
          } else {
            throw new FSError(Errno.ENOENT, path.value);
          }
        }
        else if (error.errno === GitDbErrno.ChildIsNotATree) {
          throw new FSError(Errno.ENOTDIR, path.value);
        }
        else if (error.errno === GitDbErrno.MissingObject) {
          this._isMissingObjects = true;
          throw new FSError(Errno.EIO, path.value, `Unable to find tree object '${error.objectId}' corresponding to working tree path '${path.segments.slice(0, segmentIndex + 1).join('/')}'`);
        }
      }

      throw new FSError(Errno.EIO, path.value, `Error loading tree object corresponding to working tree path '${path.segments.slice(0, segmentIndex + 1).join('/')}': ${errorToString(error)}`);
    }
  }
}
