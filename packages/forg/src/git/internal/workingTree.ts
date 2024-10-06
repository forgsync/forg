import { Hash, Mode, Type } from "./model";
import { saveObject, TreeBody } from "./objects";
import { IRepo } from "./Repo";
import { isFile } from "./util";

/**
 * Describes a folder that may or may not already exist in git.
 * This describes the set of files and folders in a tree,
 * as opposed to the hash for an existing tree object in git.
 */
export interface ExpandedTree {
  type: 'tree';
  entries: {
    [key: string]: WorkingTreeEntry;
  };
};
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
};
export interface ExistingFile {
  type: 'file'
  readonly isExecutable?: boolean;
  readonly hash: Hash;
};
export type WorkingTreeFile = ExpandedFile | ExistingFile;

export type WorkingTreeEntry = WorkingTreeFolder | WorkingTreeFile;

export async function saveWorkingTree(repo: IRepo, root: WorkingTreeFolder): Promise<Hash> {
  if ('hash' in root) return root.hash;

  const body: TreeBody = {};
  for (const name of Object.keys(root.entries)) {
    const entry = root.entries[name];
    if (entry.type === 'tree') {
      const hash = await saveWorkingTree(repo, entry);
      body[name] = { hash, mode: Mode.tree };
    } else {
      const hash = await saveFile(repo, entry);
      body[name] = { hash, mode: entry.isExecutable ? Mode.exec : Mode.file };
    }
  }

  return await saveObject(repo, { type: Type.tree, body: body });
}

async function saveFile(repo: IRepo, file: WorkingTreeFile): Promise<Hash> {
  if ('hash' in file) return file.hash;
  return await saveObject(repo, { type: Type.blob, body: file.body });
}

export function treeToWorkingTree(tree: TreeBody): ExpandedTree {
  const result: ExpandedTree = {
    type: 'tree',
    entries: {},
  };

  for (const name in tree) {
    const item = tree[name];
    if (isFile(item.mode)) {
      result.entries[name] = {
        type: 'file',
        isExecutable: item.mode === Mode.exec,
        hash: item.hash,
      };
    } else {
      result.entries[name] = {
        type: 'tree',
        hash: item.hash,
      };
    }
  }

  return result;
}
