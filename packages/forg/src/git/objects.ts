import decodeObject from "./encoding/decodeObject";
import encodeObject from "./encoding/encodeObject";
import sha1 from "./sha1";
import { Hash, ModeHash, Person, Type } from "./model";
import { IRepo } from "./Repo";

export async function saveObject(repo: IRepo, object: GitObject): Promise<Hash> {
  const raw = encodeObject(object);
  const hash = sha1(raw);
  await repo.saveRawObject(hash, raw);
  return hash;
}

export async function loadObject(repo: IRepo, hash: Hash): Promise<GitObject | undefined> {
  const raw = await repo.loadRawObject(hash);
  return raw ? decodeObject(raw) : undefined;
}

export type BlobObject = {
  readonly type: Type.blob;
  readonly body: Uint8Array;
}

export type TreeObject = {
  readonly type: Type.tree;
  readonly body: TreeBody;
}

export type TreeBody = {
  [key: string]: ModeHash;
}

export type CommitObject = {
  readonly type: Type.commit;
  readonly body: CommitBody;
}

export type CommitBody = {
  readonly tree: string;
  readonly parents: Hash[];
  readonly author: Person;
  readonly committer: Person;
  readonly message: string;
}

export type TagObject = {
  readonly type: Type.tag;
  readonly body: TagBody;
}

export type TagBody = {
  readonly object: string;
  readonly type: string;
  readonly tag: string;
  readonly tagger: Person;
  readonly message: string;
}

export type GitObject = BlobObject | TreeObject | CommitObject | TagObject;
