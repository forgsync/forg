import { Hash, Mode, Type } from "./model";
import { saveObject, TreeBody } from "./objects";
import { IRepo } from "./Repo";
import { isFile } from "./util";

/**
 * Describes a folder that isn't known to alread exist in git.
 * A new folder is described by the set of files and folders in it,
 * as opposed to being just a hash pointing at an existing tree in git.
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

export async function saveWorkingTree(repo: IRepo, workingTree: WorkingTreeFolder): Promise<Hash> {
  if ('hash' in workingTree) return workingTree.hash;

  const body: TreeBody = {};
  for (const name of Object.keys(workingTree.entries)) {
    const entry = workingTree.entries[name];
    if (entry.type === 'tree') {
      const hash = await saveWorkingTree(repo, entry);
      body[name] = { hash, mode: Mode.tree };
    } else {
      const hash = await saveFile(repo, entry);
      body[name] = { hash, mode: entry.isExecutable ? Mode.exec : Mode.file };
    }
  }

  return await saveObject(repo, {
    type: Type.tree,
    body: body,
  });
}

async function saveFile(repo: IRepo, file: WorkingTreeFile): Promise<Hash> {
  if (isHash(file)) return file.hash;
  return await saveObject(repo, { type: Type.blob, body: file.body });
}

function isHash(file: WorkingTreeFile): file is ExistingFile {
  return 'hash' in file;
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
