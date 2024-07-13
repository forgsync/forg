export enum Mode {
  tree = 0o040000,
  blob = 0o100644,
  file = 0o100644,
  exec = 0o100755,
  sym = 0o120000,
  commit = 0o160000,
}

export enum Type {
  unknown = 'unknown',
  commit = 'commit',
  tree = 'tree',
  blob = 'blob',
  tag = 'tag',
}

export type Hash = string;

export type SecondsWithOffset = {
  readonly seconds: number;
  readonly offset: number;
};

export type Person = {
  readonly name: string;
  readonly email: string;
  readonly date: SecondsWithOffset;
};

export type ModeHash = {
  readonly mode: Mode;
  readonly hash: string;
};

export interface ReflogEntry {
  previousCommit: Hash;
  newCommit: Hash;
  person: Person;
  description: string;
}
