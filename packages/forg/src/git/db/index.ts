export type { Hash, ModeHash, Person, SecondsWithOffset, ReflogEntry } from './model';
export { Mode, Type } from './model';

export { Repo, InitMode } from './Repo';
export type { IRepo, IReadOnlyRepo } from './Repo';

export {
  loadCommitObject,
  loadTreeObject,
  loadBlobObject,
  loadTagObject,
  saveObject,
} from './objects';
export type {
  GitObject,
  BlobObject,
  TreeObject,
  CommitObject,
  TagObject,
  TreeBody,
  CommitBody,
  TagBody,
} from './objects';
export { loadConfig, GitConfig } from './config';

export { createCommit } from './createCommit';
export { updateRef } from './updateRef';

export { saveWorkingTree, treeToWorkingTree } from './workingTree';
export type {
  ExpandedFile, ExistingFile, WorkingTreeFile,
  ExpandedTree, ExistingTree, WorkingTreeFolder,
} from './workingTree';

export { walkCommits, walkTree, listFiles } from './walkers';
export type { HashAndCommitBody, HashModePath } from './walkers';

export { MissingObjectError, ObjectTypeMismatchError } from './errors';
