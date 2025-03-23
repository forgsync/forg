import { GitTreeFS, Hash } from "../../../git";

export abstract class ForgContainer {
  constructor(
    readonly rootFS: GitTreeFS,
  ) { }

  get hash(): Hash {
    if (this.rootFS.isModified) {
      throw new Error('Expected unmodified root');
    }
    const hash = this.rootFS.originalHash;
    if (hash === undefined) {
      throw new Error("Expected originalHash to be defined at the root. Perhaps the underlying GitTreeFS didn't come from a real git tree?");
    }

    return hash;
  }

  reconcile(other: ForgContainer): Promise<GitTreeFS> {
    if (other.constructor !== this.constructor) {
      throw new Error("Mismatched container types");
    }

    if (other.rootFS.repo !== this.rootFS.repo) {
      throw new Error("Mismatched repo's");
    }

    return this.reconcileCore(other);
  }

  protected abstract reconcileCore(other: ForgContainer): Promise<GitTreeFS>;
}
