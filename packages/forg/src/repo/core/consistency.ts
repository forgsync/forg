
export enum ConsistencyMode {
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
   */
  OptimisticAssumeConnectivity = 1,

  /**
   * If an object exists in the destination repo, assume that it is well-formed, but not that its dependencies are as well.
   * This can be costly, as it will mean at the very least an object existence check will be performed for all objects.
   * This is an intermediate consistency mode between `OptimisticAssumeConnectivity` and `Pessimistic`.
   */
  OptimisticAssumeObjectIntegrity = 2,

  /**
   * Makes no assumption about the integrity of any objects in the destination, and copies everything again.
   * Can be useful to recover after catastrophic data loss at the destination.
   * This is the highest consistency mode, but also the slowest (analogous to a clone from scratch).
   */
  Pessimistic = 3
}

export interface CloneConsistencyOptions {
  /**
   * Consistency mode when cloning the head commit. Defaults to `OptimisticAssumeConnectivity`.
   * You can use a stronger consistency mode for the head commit than others when the integrity of the history is not as important as that of the head commit.
   */
  headCommit: ConsistencyMode;

  /**
   * Consistency mode when cloning commits other than the head. Defaults to `OptimisticAssumeConnectivity`.
   */
  parentCommits: ConsistencyMode;
}

export function defaultConsistencyOptions(): CloneConsistencyOptions {
  return {
    headCommit: ConsistencyMode.OptimisticAssumeConnectivity,
    parentCommits: ConsistencyMode.OptimisticAssumeConnectivity,
  };
}
