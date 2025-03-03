import decodeObject from './encoding/decodeObject';
import encodeObject from './encoding/encodeObject';
import sha1 from './sha1';
import { Hash, ModeHash, Person, Type } from './model';
import { IReadOnlyRepo, IRepo } from './Repo';
import { createObjectTypeMismatchError, GitDbErrno, GitDbError } from './errors';
import { errorToString } from './util';

export async function saveObject(repo: IRepo, object: GitObject): Promise<Hash> {
  const raw = encodeObject(object);
  const hash = sha1(raw);
  await repo.saveRawObject(hash, raw);
  return hash;
}

export async function loadCommitObject(repo: IReadOnlyRepo, hash: Hash): Promise<CommitObject> {
  const object = await loadObject(repo, hash);
  if (object.type !== 'commit') {
    throw createObjectTypeMismatchError(hash, Type.commit, object.type);
  }

  return object;
}

export function decodeCommitObject(raw: Uint8Array, hash: Hash): CommitObject {
  const object = decodeObjectAndWrapErrors(raw, hash);
  if (object.type !== 'commit') {
    throw createObjectTypeMismatchError(hash, Type.commit, object.type);
  }

  return object;
}

export async function loadTreeObject(repo: IReadOnlyRepo, hash: Hash): Promise<TreeObject> {
  const object = await loadObject(repo, hash);
  if (object.type !== 'tree') {
    throw createObjectTypeMismatchError(hash, Type.tree, object.type);
  }

  return object;
}

export async function loadBlobObject(repo: IReadOnlyRepo, hash: Hash): Promise<BlobObject> {
  const object = await loadObject(repo, hash);
  if (object.type !== 'blob') {
    throw createObjectTypeMismatchError(hash, Type.blob, object.type);
  }

  return object;
}

export async function loadTagObject(repo: IReadOnlyRepo, hash: Hash): Promise<TagObject | undefined> {
  const object = await loadObject(repo, hash);
  if (object.type !== 'tag') {
    throw createObjectTypeMismatchError(hash, Type.tag, object.type);
  }

  return object;
}

async function loadObject(repo: IReadOnlyRepo, hash: Hash): Promise<GitObject> {
  const raw = await repo.loadRawObject(hash);
  return decodeObjectAndWrapErrors(raw, hash);
}

function decodeObjectAndWrapErrors(raw: Uint8Array, hash: Hash): GitObject {
  try {
    return decodeObject(raw);
  }
  catch (error) {
    throw new GitDbError(GitDbErrno.InvalidData, `: ${errorToString(error)}`).withObjectId(hash);
  }
}

export type BlobObject = {
  readonly type: Type.blob;
  readonly body: Uint8Array;
};

export type TreeObject = {
  readonly type: Type.tree;
  readonly body: TreeBody;
};

export type TreeBody = {
  [key: string]: ModeHash;
};

export type CommitObject = {
  readonly type: Type.commit;
  readonly body: CommitBody;
};

export type CommitBody = {
  readonly tree: string;
  readonly parents: Hash[];
  readonly author: Person;
  readonly committer: Person;
  readonly message: string;
};

export type TagObject = {
  readonly type: Type.tag;
  readonly body: TagBody;
};

export type TagBody = {
  readonly object: string;
  readonly type: string;
  readonly tag: string;
  readonly tagger: Person;
  readonly message: string;
};

export type GitObject = BlobObject | TreeObject | CommitObject | TagObject;
