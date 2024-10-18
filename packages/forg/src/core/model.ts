export interface ForgClientInfo {
  uuid: string;
}

export type ForgBranch = ForgRemoteBranch | ForgHeadBranch;
interface ForgBranchBase {
  branchName: string;
}
export interface ForgRemoteBranch extends ForgBranchBase {
  kind: 'remote';
  client: ForgClientInfo;
}
export interface ForgHeadBranch extends ForgBranchBase {
  kind: 'head',
}

export enum SyncConsistency {
  /**
   * Skips copying entirely. This can be used to achieve something analogous to a git shallow clone when applied to `CloneConsistencyOptions.parentCommits`.
   */
  Skip = 0,

  /**
   * If an object exists in the destination repo, assume that it is well-formed and that all of its dependencies are as well, at all levels.
   * This is the lowest consistency mode, and the fastest.
   * Examples:
   *   - If a commit object already exists in the destination, we stop, assuming that it and its dependencies (e.g. its tree object and parent commits) are valid in the destination already;
   *   - If a commit object does not exist, but its associated tree does, we copy the commit object but not its tree, since we assume the dependencies that *do* exists are valid.
   *   - Etc.
   * NOTE: The term connectivity refers to the graph being connected, and has nothing to do with network connection conditions.
   */
  AssumeConnectivity = 1,

  /**
   * If an object exists in the destination repo, assume that it is well-formed, but not that its dependencies are as well.
   * This can be costly, as it will mean at the very least an object existence check will be performed for all objects.
   * This is an intermediate consistency mode between `AssumeConnectivity` and `Pessimistic`.
   */
  AssumeObjectIntegrity = 2,

  /**
   * Makes no assumption about the integrity of any objects in the destination, and copies everything again.
   * Can be useful to recover after catastrophic data loss at the destination.
   * This is the highest consistency mode, but also the slowest (analogous to a clone from scratch).
   */
  Pessimistic = 3
}

export interface SyncOptions {
  /**
   * Consistency mode when cloning the top commit.
   * You can use a stronger consistency mode for the top commit than others (e.g. when the integrity of the history is not as important as that of the top commit).
   * @default AssumeConnectivity
   */
  topCommitConsistency: SyncConsistency;

  /**
   * Consistency mode when cloning commits other than the top commit.
   * @default AssumeConnectivity
   */
  otherCommitsConsistency: SyncConsistency;

  /**
   * Whether an incomplete commit history in the src repo is acceptable. If set to true, sync will succeed even if one of the traversed commits in the source repo is incomplete (but the head commit must always exist).
   * If false, the corresponding git error may bubble out (i.e. `MissingObjectError`).
   * @default true
   */
  allowShallow: boolean;

  /**
   * Whether to attempt to deepen the history in the destination, useful to achieve eventual consistency when a previous sync specified `allowShallow` true.
   * This comes at a perf penalty, and the local repo will have to be traversed all the way in order to find all shallow commits.
   */
  attemptDeepen: boolean;
}
