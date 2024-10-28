export enum SyncConsistency {
  /**
   * Skips copying entirely. This can be used to achieve something analogous to a git shallow clone when applied to `CloneConsistencyOptions.parentCommits`.
   */
  Skip = 0,

  /**
   * If an object exists in the destination repo, assume that it is well-formed and that all of its dependencies are as well, at all levels.
   * This is the lowest consistency mode, and provides for the fastest sync.
   * Examples:
   *   - If a commit object already exists in the destination, we stop, assuming that it and its dependencies (e.g. its tree object and parent commits) are valid in the destination already;
   *   - If a commit object does not exist, but its associated tree does, we copy the commit object but not its tree, since we assume the dependencies that *do* exists are valid.
   *   - Etc.
   * NOTE: The term connectivity refers to the graph being connected, and has nothing to do with network connection conditions.
   */
  AssumeTotalConnectivity = 1,

  /**
   * Different assumptions for different object types:
   * - Commit objects: If a commit object exists in the destination repo, assume that it is well-formed and that its tree and the tree's dependencies are as well
   * - Everything else (trees, blobs): If a non-commit object exists in the destination repo, assume that it is well-formed and that all of its dependencies are as well
   * 
   * This mode is useful to achieve eventual consistency when fetching from a remote that had files written to out of order.
   * The first fetch attempts might result in a shallow git history, and a later fetch would then sync the remainder of the history that had been skipped the first time.
   */
  AssumeCommitConnectivity = 2,

  /**
   * If an object exists in the destination repo, assume that it is well-formed, but not that its dependencies are as well.
   * This can be costly, as it will mean at the very least an object existence check will be performed for all objects.
   */
  AssumeObjectIntegrity = 3,

  /**
   * Makes no assumption about the integrity of any objects in the destination, and copies everything again.
   * Can be useful to recover after catastrophic data loss at the destination.
   * This is the highest consistency mode, but also the slowest (analogous to a clone from scratch).
   */
  Pessimistic = 4
}

export interface SyncOptions {
  /**
   * Consistency mode when cloning the top commit.
   * You can use a stronger consistency mode for the top commit than others (e.g. when the integrity of the history is not as important as that of the top commit).
   */
  topCommitConsistency: SyncConsistency;

  /**
   * Consistency mode when cloning commits other than the top commit.
   */
  otherCommitsConsistency: SyncConsistency;

  /**
   * Whether an incomplete commit history in the src repo is acceptable. If set to true, sync will succeed even if one of the traversed commits in the source repo is incomplete (but the head commit must always exist).
   * If false, the corresponding git error may bubble out (i.e. `MissingObjectError`).
   */
  allowShallow: boolean;
}
