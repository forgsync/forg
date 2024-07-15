import decodeObject from './encoding/decodeObject';
import encodeObject from './encoding/encodeObject';
import sha1 from './sha1';
import { Hash, ModeHash, Person, Type } from './model';
import { IRepo } from './Repo';
import { ObjectTypeMismatchError } from './errors';

export async function saveObject(repo: IRepo, object: GitObject): Promise<Hash> {
  const raw = encodeObject(object);
  const hash = sha1(raw);
  await repo.saveRawObject(hash, raw);
  return hash;
}

async function loadObject(repo: IRepo, hash: Hash): Promise<GitObject> {
  const raw = await repo.loadRawObject(hash);
  return decodeObject(raw);
}

export async function loadCommitObject(repo: IRepo, hash: Hash): Promise<CommitObject> {
  const object = await loadObject(repo, hash);
  if (object.type !== 'commit') {
    throw new ObjectTypeMismatchError(hash, Type.commit, object.type);
  }

  return object;
}

export async function loadTreeObject(repo: IRepo, hash: Hash): Promise<TreeObject> {
  const object = await loadObject(repo, hash);
  if (object.type !== 'tree') {
    throw new ObjectTypeMismatchError(hash, Type.tree, object.type);
  }

  return object;
}

export async function loadBlobObject(repo: IRepo, hash: Hash): Promise<BlobObject> {
  const object = await loadObject(repo, hash);
  if (object.type !== 'blob') {
    throw new ObjectTypeMismatchError(hash, Type.blob, object.type);
  }

  return object;
}

export async function loadTagObject(repo: IRepo, hash: Hash): Promise<TagObject | undefined> {
  const object = await loadObject(repo, hash);
  if (object !== undefined && object.type !== 'tag') {
    throw new ObjectTypeMismatchError(hash, Type.tag, object.type);
  }

  return object;
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
