import {
  Hash,
  IReadOnlyRepo,
  IRepo,
  loadTreeObject,
  MissingObjectError,
  Mode,
} from '../db';
import { decodeCommitObject } from '../db/objects';

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
   * - Commit objects: If a commit object exists in the destination repo, assume that it is well-formed and that its tree and the tree's dependencies are as well (but makes no assumptions about the parents' integrity);
   * - Everything else (trees, blobs): If a non-commit object exists in the destination repo, assume that it is well-formed and that all of its dependencies are as well.
   * 
   * This mode is useful to achieve eventual consistency when fetching from a remote that had files written to out of order.
   * The first fetch attempts might result in a shallow git history, and a later fetch would then sync the remainder of the history that had been skipped the first time.
   * NOTE: The term connectivity refers to the graph being connected, and has nothing to do with network connection conditions.
   */
  AssumeCommitTreeConnectivity = 2,

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

/**
 * Low level primitive used to sync a commit and its dependencies between repo's.
 * This implementation is symmetric regardless of whether `src` / `dst` are local / remote repo's, and as such this is used for both `fetch` and `push`.
 */
export async function syncCommit(src: IReadOnlyRepo, dst: IRepo, commitId: string, options: SyncOptions): Promise<void> {
  //console.log(`Syncing commit ${commitId}`);
  if (options.topCommitConsistency === SyncConsistency.Skip) {
    throw new Error(`Invalid headCommitConsistency (${SyncConsistency[options.topCommitConsistency]})`);
  }

  if (options.topCommitConsistency < options.otherCommitsConsistency) {
    throw new Error(
      `Invalid consistency options, expected headCommitConsistency (${SyncConsistency[options.topCommitConsistency]}) ` +
      `to be higher or equal to otherCommitsConsistency (${SyncConsistency[options.otherCommitsConsistency]})`);
  }

  // Step 1: Walk the commit history and sync all the trees that we find along the way, but do not sync the commit objects yet. We will do that in step 2.
  // This sequence ensures that we will know precisely how far down the git history we are going before we write even a single commit object in step 2 (relevant when `options.allowShallow` is true),
  // and guarantees that we will never write an object before all of its dependencies are written (the only exception being a shallow sync, where deliberately we will skip some parent commits).
  const commitsToSync = await syncTrees(src, dst, commitId, options);

  // Step 2: Sync commit objects backwards. It is important to go backwards (older ones first) so that the git graph remains connected at all times,
  // (i.e. we never store an object until all dependencies are stored, including in case of an unexpected exit)
  for (const [curCommitId, rawCommit] of commitsToSync.reverse()) {
    const isTop = curCommitId === commitId;
    const consistency = isTop ? options.topCommitConsistency : options.otherCommitsConsistency;
    await syncObject2(dst, curCommitId, rawCommit, consistency);
  }
}

/**
 * Walks the history starting from `commitId`, syncs each tree found along the way, and keeps going until we are done or,
 * if `options.allowShallow` is true, until we cannot go further (e.g. because some objects are missing in src, possibly as a result of a deliberate history truncation).
 * @returns an array of tuples, where each element in the array indicates a commit and the corresponding raw commit object contents that should be synced by the caller.
 */
async function syncTrees(src: IReadOnlyRepo, dst: IRepo, commitId: string, options: SyncOptions): Promise<[Hash, Uint8Array][]> {
  const commits = new Map<Hash, Uint8Array | null>();
  let heads: Hash[] = [commitId];
  while (heads.length > 0) {
    const nextHeads: Hash[] = [];
    for (const head of heads) {
      {
        // Handle cases where forks and merges lead to the same commit appearing multiple times as we go through the commit history...
        // Example:
        // A ------- C
        //  \         \
        //   B -- D -- E (`commitId`)
        //
        // In this case, when attempting to sync E, we would traverse the graph as E, C, D, A, B, A. Notice A would be synced twice.
        // It is important that, in the array we return, we end up with sequence E, C, D, B, A (A must appear only once and must come last, otherwise we would end up storing commits out of order before all dependencies have been stored).
        //
        const existing = commits.get(head);
        if (existing !== undefined) {
          // Re-add it at the end since we now learned of another route that depends on this commit. But we don't need to sync it again...
          commits.delete(head);
          commits.set(head, existing);
          continue;
        }
      }

      const isTop = head === commitId;
      const consistency = isTop ? options.topCommitConsistency : options.otherCommitsConsistency;
      if (consistency === SyncConsistency.Skip) {
        continue;
      }

      let dstHasIt = false;

      // If we can at least assume object integrity, then checking if the object exists in the destination is useful, as we may be able to skip syncing it.
      if (consistency <= SyncConsistency.AssumeObjectIntegrity) {
        dstHasIt = await dst.hasObject(head);

        if (consistency === SyncConsistency.AssumeTotalConnectivity && dstHasIt) {
          // If commit already exists in the destination and we are assuming connectivity, then we can assume that all of its dependencies (parent commits, trees, blobs) already exist in the destination.
          // So we are done...
          continue;
        }
      }

      const skipOnError = options.allowShallow && !isTop;
      try {
        // NOTE: From this point on, any MissingObjectError would indicate an incomplete commit on the source.
        // Such commits can be safely ignored when we aren't syncing the top commit and we allow shallow syncs
        const rawSrcCommit = await src.loadRawObject(head);
        const srcCommit = decodeCommitObject(rawSrcCommit);

        // Only sync the commit and its tree if we have to. For example, when using consistency mode `AssumeCommitTreeConnectivity`, we can often skip this.
        if (consistency >= SyncConsistency.AssumeObjectIntegrity || !dstHasIt) {
          // NOTE: This may leave orphaned files in the destination repo (in case we fail before all commit objects have been written, or if we encounter a tree with missing objects).
          // Such orphaned files are harmless (and deleting them could be catastrophic in case another client had also just written them and expects them to stay. Since we cannot be sure nobody else relies on these files, we cannot delete).
          // Deletion would only be possible from a separate, explicit and potentially destructive method to garbage-collect the destination repo.
          await syncTree(src, dst, srcCommit.body.tree, consistency);

          // If we get here, then syncTree succeeded!
          commits.set(head, rawSrcCommit);
        }

        nextHeads.push(...srcCommit.body.parents);
      } catch (error) {
        if (skipOnError && error instanceof MissingObjectError) {
          commits.set(head, null);
          continue;
        }

        throw error;
      }
    }

    heads = nextHeads;
  }

  return Array.from(commits).filter(a => a[1] !== null) as [Hash, Uint8Array][];
}

async function syncTree(src: IReadOnlyRepo, dst: IRepo, treeHash: string, consistency: SyncConsistency): Promise<void> {
  //console.log(`Syncing tree ${treeHash}`);
  if (consistency <= SyncConsistency.AssumeCommitTreeConnectivity) {
    if (await dst.hasObject(treeHash)) {
      // Tree already exists in the destination and we are assuming connectivity, so all of its dependencies (other trees, blobs) are assumed to also exist in the destination.
      // We can stop this traversal...
      return;
    }
  }

  const tree = await loadTreeObject(src, treeHash);
  for (const name of Object.keys(tree.body)) {
    const { mode, hash } = tree.body[name];

    if (mode === Mode.tree) {
      await syncTree(src, dst, hash, consistency);
    } else {
      await syncObject(src, dst, hash, consistency);
    }
  }

  // Important: copy the tree object last, so that all of its dependencies were already copied before it.
  await syncObject(src, dst, treeHash, consistency);
}

async function syncObject(src: IReadOnlyRepo, dst: IRepo, hash: Hash, consistency: SyncConsistency): Promise<void> {
  //console.log(`Syncing object ${hash}`);
  if (consistency <= SyncConsistency.AssumeObjectIntegrity) {
    if (await dst.hasObject(hash)) {
      return;
    }
  }

  const raw = await src.loadRawObject(hash);
  await dst.saveRawObject(hash, raw);
}

async function syncObject2(dst: IRepo, hash: Hash, raw: Uint8Array, consistency: SyncConsistency): Promise<void> {
  //console.log(`Syncing object ${hash}`);
  if (consistency <= SyncConsistency.AssumeObjectIntegrity) {
    if (await dst.hasObject(hash)) {
      return;
    }
  }

  await dst.saveRawObject(hash, raw);
}
