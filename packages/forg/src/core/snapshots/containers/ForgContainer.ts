import { GitTreeFS, Hash } from "../../../git";
import { HeadInfo } from "../../model";

export abstract class ForgContainer {
  constructor(
    readonly head: HeadInfo,
    readonly rootFS: GitTreeFS,
  ) { }

  get treeHash(): Hash {
    return this.rootFS.hash;
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
