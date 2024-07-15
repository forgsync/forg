export type { Hash, ModeHash, Person, SecondsWithOffset, ReflogEntry } from './internal/model';
export { Mode, Type } from './internal/model'

export { Repo } from './internal/Repo';
export type { IRepo } from './internal/Repo';

export {
  loadCommitObject,
  loadTreeObject,
  loadBlobObject,
  loadTagObject,
  saveObject,
} from './internal/objects';
export type {
  GitObject,
  BlobObject,
  TreeObject,
  CommitObject,
  TagObject,
  TreeBody,
  CommitBody,
  TagBody,
} from './internal/objects';

export { createCommit, updateRef } from './internal/commits';

export { saveWorkingTree, treeToWorkingTree } from './internal/workingTree';
export type {
  ExpandedFile, ExistingFile, WorkingTreeFile,
  ExpandedTree, ExistingTree, WorkingTreeFolder,
} from './internal/workingTree';

export { walkCommits, walkTree, listFiles } from './internal/walkers';
export type { HashAndCommitBody, HashModePath } from './internal/walkers';

export { MissingObjectError, ObjectTypeMismatchError } from './internal/errors';
