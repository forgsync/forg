import { GitTreeFS, Hash } from "../../../git";

export abstract class ForgContainer {
  constructor(
    readonly rootFS: GitTreeFS,
  ) { }

  get hash(): Hash {
    if (this.rootFS instanceof GitTreeFS) {
      if (this.rootFS.isModified) {
        throw new Error('Expected unmodified root');
      }
      const hash = this.rootFS.originalHash;
      if (hash === undefined) {
        throw new Error("Expected originalHash to be defined at the root. Perhaps the underlying GitTreeFS didn't come from a real git tree?");
      }

      return hash;
    }

    // Note: Should we try to compute the hash if root isn't a GitTreeFS? This might only be useful for tests, seems pointless to implement
    throw new Error('Not implemented for non-GitTreeFS roots');
  }

  abstract reconcile(other: ForgContainer): Promise<GitTreeFS>;
}
