import { Path } from '@forgsync/simplefs';
import { GitDbErrno, GitDbError } from './errors';
import { Hash, Mode, Type } from './model';
import { loadTreeObject, saveObject, TreeBody } from './objects';
import { IRepo } from './Repo';
import { isFile } from './util';

/**
 * Describes a folder that may or may not already exist in git.
 * This describes the set of files and folders in a tree,
 * as opposed to the hash for an existing tree object in git.
 */
export interface ExpandedTree {
  type: 'tree';

  /**
   * The object id that represented this tree initially. If the tree is subsequently modified, this is not automatically updated, and would continue to reflect the original hash.
   * If this object was created dynamically (as opposed to being read from an actual repo), then it will be undefined.
   */
  originalHash?: Hash;

  entries: Map<string, WorkingTreeEntry>;
}
/**
 * Describes an existing tree in git, indicated by its hash.
 */
export interface ExistingTree {
  type: 'tree';
  hash: Hash;
}
export type WorkingTreeFolder = ExpandedTree | ExistingTree;

/**
 * Describes a folder that may or may not already exist in git.
 * This describes the file contents, as opposed to being just a hash
 * for an existing blob object in git.
 */
export interface ExpandedFile {
  type: 'file';
  readonly isExecutable?: boolean;
  readonly body: Uint8Array;
}
export interface ExistingFile {
  type: 'file';
  readonly isExecutable?: boolean;
  readonly hash: Hash;
}
export type WorkingTreeFile = ExpandedFile | ExistingFile;

export type WorkingTreeEntry = WorkingTreeFolder | WorkingTreeFile;

export async function saveWorkingTree(repo: IRepo, root: WorkingTreeFolder): Promise<Hash> {
  if ('hash' in root) return root.hash;

  const body: TreeBody = {};
  for (const [name, entry] of root.entries) {
    if (entry.type === 'tree') {
      const hash = await saveWorkingTree(repo, entry);
      body[name] = { hash, mode: Mode.tree };
    } else {
      const hash = await saveFile(repo, entry);
      body[name] = { hash, mode: entry.isExecutable ? Mode.exec : Mode.file };
    }
  }

  const hash = await saveObject(repo, { type: Type.tree, body: body });
  root.originalHash = hash;
  return hash;
}

async function saveFile(repo: IRepo, file: WorkingTreeFile): Promise<Hash> {
  if ('hash' in file) return file.hash;
  return await saveObject(repo, { type: Type.blob, body: file.body });
}

export function treeToWorkingTree(tree: TreeBody, hash: Hash): ExpandedTree {
  const result: ExpandedTree = {
    type: 'tree',
    originalHash: hash,
    entries: new Map(),
  };

  for (const name in tree) {
    const item = tree[name];
    let entry: ExistingFile | ExistingTree =
      isFile(item.mode)
        ? { type: 'file', hash: item.hash, isExecutable: item.mode === Mode.exec, }
        : { type: 'tree', hash: item.hash, };
    result.entries.set(name, entry);
  }

  return result;
}

export async function expandSubTree(repo: IRepo, tree: ExpandedTree, childName: string): Promise<ExpandedTree> {
  const item = tree.entries.get(childName);
  if (item === undefined) {
    throw new GitDbError(GitDbErrno.TreeEntryNotFound, 'No such entry in tree').withObjectId(tree.originalHash).withPath(new Path(childName));
  }

  if (item.type !== 'tree') {
    throw new GitDbError(GitDbErrno.ChildIsNotATree, 'Cannot expand a child entry that is not a tree').withObjectId('hash' in item ? item.hash : undefined).withPath(new Path(childName));
  }


  if ('hash' in item) {
    const treeObject = await loadTreeObject(repo, item.hash);
    const expandedFolder = treeToWorkingTree(treeObject.body, item.hash);
    tree.entries.set(childName, expandedFolder);
    return expandedFolder;
  } else {
    return item;
  }
}