export type { Hash, ModeHash, Person, SecondsWithOffset } from './model';
export { Mode, Type } from './model'

export { Repo } from './Repo';
export type { IRepo } from './Repo';

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

export { createCommit, updateRef } from './commits';

export { saveWorkingTree, treeToWorkingTree } from './workingTree';
export type {
  ExpandedFile, ExistingFile, WorkingTreeFile,
  ExpandedTree, ExistingTree, WorkingTreeFolder,
} from './workingTree';

export { walkCommits, walkTree, listFiles } from './walkers';
export type { HashAndCommitBody, HashModePath } from './walkers';

export { MissingObjectError, ObjectTypeMismatchError } from './errors';
