import { Hash, Mode, ModeHash, Type } from "./model";
import { saveObject, TreeBody } from "./objects";
import { IRepo } from "./Repo";
import { isFile } from "./util";

/**
 * Describes a folder that isn't known to alread exist in git.
 * A new folder is described by the set of files and folders in it,
 * as opposed to being just a hash pointing at an existing tree in git.
 */
export type ExpandedFolder = {
  files: {
    [key: string]: WorkingTreeFile;
  };
  folders: {
    [key: string]: WorkingTreeFolder;
  };
};
/**
 * Describes an existing tree in git, indicated by its hash.
 */
export type ExistingFolder = Hash;
export type WorkingTreeFolder = ExpandedFolder | ExistingFolder;

export type ExpandedFile = {
  readonly isExecutable?: boolean;
  readonly body: Uint8Array;
};
export type ExistingFile = {
  readonly isExecutable?: boolean;
  readonly hash: Hash;
};
export type WorkingTreeFile = ExpandedFile | ExistingFile;

export async function saveWorkingTree(repo: IRepo, workingTree: WorkingTreeFolder): Promise<Hash> {
  if (typeof workingTree === 'string') return workingTree;

  const body: { [key: string]: ModeHash } = {};

  if (workingTree.folders) {
    for (const name of Object.keys(workingTree.folders)) {
      const hash = await saveWorkingTree(repo, workingTree.folders[name]);
      body[name] = { hash, mode: Mode.tree };
    }
  }

  if (workingTree.files) {
    for (const name of Object.keys(workingTree.files)) {
      const hash = await saveFile(repo, workingTree.files[name]);
      body[name] = { hash, mode: workingTree.files[name].isExecutable ? Mode.exec : Mode.file };
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

export function treeToWorkingTree(tree: TreeBody): ExpandedFolder {
  const result: ExpandedFolder = {
    files: {},
    folders: {},
  };

  for (const name in tree) {
    const item = tree[name];
    if (isFile(item.mode)) {
      result.files[name] = {
        hash: item.hash,
      };
    } else {
      result.folders[name] = item.hash;
    }
  }

  return result;
}
