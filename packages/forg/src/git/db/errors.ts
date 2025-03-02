import { Path } from '@forgsync/simplefs';
import { Hash, Type } from './model';

export enum GitDbErrno {
  BadRepo,
  MissingObject,
  ObjectTypeMismatch,
  InvalidData,
}

export class GitDbError extends Error {
  private _errno: GitDbErrno;
  private _objectId?: Hash;
  private _ref?: string;
  private _path?: Path;

  get errno() { return this._errno; }
  get objectId() { return this._objectId; }
  get ref() { return this._ref; }

  constructor(errno: GitDbErrno, details?: string) {
    super(`${GitDbErrno[errno]}${details ? `. Details: ${details}` : ''}`);
    this._errno = errno;
  }

  withObjectId(objectId: Hash): GitDbError {
    if (this._objectId === undefined) {
      this._objectId = objectId;
    }

    return this;
  }

  withRef(ref: string): GitDbError {
    if (this._ref === undefined) {
      this._ref = ref;
    }

    return this;
  }

  withPath(path: Path): GitDbError {
    if (this._path === undefined) {
      this._path = path;
    }

    return this;
  }
}

export function createObjectTypeMismatchError(hash: Hash, expectedType: Type, actualType: Type) {
  return new GitDbError(GitDbErrno.ObjectTypeMismatch, `Object ${hash} is not a ${expectedType}, found ${actualType}`).withObjectId(hash);
}
