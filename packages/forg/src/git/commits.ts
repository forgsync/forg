import { Hash, Mode, ModeHash, Person, Type } from './model';
import { saveObject } from './objects';
import { IRepo } from './Repo';

/**
 * Describes a folder that isn't known to alread exist in git.
 * A new folder is described by the set of files and folders in it,
 * as opposed to being just a hash pointing at an existing tree in git.
 */
export type NewFolder = {
  readonly files?: {
    readonly [key: string]: File;
  };
  readonly folders?: {
    readonly [key: string]: Folder;
  };
};
/**
 * Describes an existing tree in git, indicated by its hash.
 */
export type ExistingFolder = Hash;
export type Folder = NewFolder | ExistingFolder;

export type BinaryFile = {
  readonly isExecutable?: boolean;
  readonly body: Uint8Array;
};
export type ExistingFile = {
  readonly isExecutable?: boolean;
  readonly hash: Hash;
};
export type File = BinaryFile | ExistingFile;

export async function createCommit(
  repo: IRepo,
  tree: Folder,
  parents: Hash[],
  message: string,
  author: Person,
  committer: Person = author,
): Promise<Hash> {
  const treeHash = await saveTree(repo, tree);
  const hash = await saveObject(repo, {
    type: Type.commit,
    body: {
      tree: treeHash,
      parents,
      author,
      committer,
      message,
    },
  });
  return hash;
}

export async function updateRef(
  repo: IRepo,
  ref: string,
  commitId: Hash,
  person: Person,
  reflogMessage: string,
): Promise<void> {
  // TODO: This method should be atomic (updating the ref and the reflog)
  const originalHash = await repo.getRef(ref);
  await repo.setRef(ref, commitId);

  const reflog = await repo.getReflog(ref);
  reflog.push({
    previousCommit: originalHash ?? '0'.repeat(40),
    newCommit: commitId,
    person: person,
    description: reflogMessage,
  });
  await repo.setReflog(ref, reflog);
}

async function saveTree(repo: IRepo, folder: NewFolder | Hash): Promise<Hash> {
  if (typeof folder === 'string') return folder;

  const body: { [key: string]: ModeHash } = {};

  if (folder.folders) {
    for (const name of Object.keys(folder.folders)) {
      const hash = await saveTree(repo, folder.folders[name]);
      body[name] = { hash, mode: Mode.tree };
    }
  }

  if (folder.files) {
    for (const name of Object.keys(folder.files)) {
      const hash = await saveFile(repo, folder.files[name]);
      body[name] = { hash, mode: folder.files[name].isExecutable ? Mode.exec : Mode.file };
    }
  }

  return await saveObject(repo, {
    type: Type.tree,
    body: body,
  });
}

async function saveFile(repo: IRepo, file: File): Promise<Hash> {
  if (isHash(file)) return file.hash;
  return await saveObject(repo, { type: Type.blob, body: file.body });
}

function isHash(file: File): file is ExistingFile {
  return 'hash' in file;
}
