import { Hash, Type } from "./model";

export class MissingObjectError extends Error {
  hash: Hash;

  constructor(hash: Hash) {
    super(`Object does not exist: ${hash}`);
    this.hash = hash;
  }
}

export class ObjectTypeMismatchError extends Error {
  hash: Hash;
  expectedType: Type;
  actualType: Type;

  constructor(hash: Hash, expectedType: Type, actualType: Type) {
    super(`Object ${hash} is not a ${expectedType}, found ${actualType}`);
    this.hash = hash;
    this.expectedType = expectedType;
    this.actualType = actualType;
  }
}
