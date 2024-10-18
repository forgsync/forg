import {
  CommitObject,
  Hash,
  IReadOnlyRepo,
  IRepo,
  loadCommitObject,
  loadTreeObject,
  MissingObjectError,
  Mode,
} from '../git';
import { SyncOptions, SyncConsistency } from "./model";

/**
 * Low level primitive used to sync a commit and its dependencies between repo's.
 * This implementation is symmetric regardless of whether `src` / `dst` are local / remote repo's, and as such this is used for both `fetch` and `forcePush`.
 */
export async function syncCommit(src: IReadOnlyRepo, dst: IRepo, commitHash: string, options: SyncOptions): Promise<void> {
  //console.log(`Syncing commit ${commitHash}`);
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
  const commitsToSync = await syncTrees(src, dst, commitHash, options);

  // Step 2: Sync commit objects backwards. It is important to go backwards (older ones first) so that the git graph remains connected at all times,
  // (i.e. we never store an object until all dependencies are stored, including in case of an unexpected exit)
  for (const commit of commitsToSync.reverse()) {
    const isTop = commit.oid === commitHash;
    const consistency = isTop ? options.topCommitConsistency : options.otherCommitsConsistency;
    await syncObject(src, dst, commit.oid, consistency);
  }

  // Future: support `options.attemptDeepen`.
  // Future: Consider storing the list of shallow commits that we ended up with (e.g. `commitsToSync.filter(c => c.shallow)`) in file `/shallow`, but only in the local repo. See: https://git-scm.com/docs/shallow
}

/**
 * Walks the history starting from `commitHash`, syncs each tree found along the way, and keeps going until we are done or,
 * if `options.allowShallow` is true, until we cannot go further (e.g. because some objects are missing in src, possibly as a result of a deliberate history truncation).
 */
async function syncTrees(src: IReadOnlyRepo, dst: IRepo, commitHash: string, options: SyncOptions): Promise<{ oid: Hash, shallow: boolean }[]> {
  const allCommits: { oid: Hash, shallow: boolean }[] = [];

  interface SearchHead {
    referencedByCommitIndex: number | undefined;
    oid: Hash;
  }
  let heads: SearchHead[] = [{ referencedByCommitIndex: undefined, oid: commitHash }];
  while (heads.length > 0) {
    const nextHeads: SearchHead[] = [];
    for (const head of heads) {
      const isTop = head.oid === commitHash;
      const consistency = isTop ? options.topCommitConsistency : options.otherCommitsConsistency;

      let includeInSync: boolean;
      if (consistency === SyncConsistency.Skip) {
        includeInSync = false;
      }
      else if (consistency === SyncConsistency.AssumeConnectivity) {
        // If commit already exists in the destination and we are assuming connectivity, then we can assume that all of its dependencies (parent commits, trees, blobs) also exist in the destination.
        //
        // Future: it may be interesting to support a sync mode where we would assume graph connectivity, but would also try to deepen the history at dst in case it is currently a shallower copy than the src.
        // This would really only be meaningful during a `fetch` operation in the case where the remote data provider contained partial data in a previous `fetch` attempt, which would have resulted in a shallow fetch.
        // Right now, that would lead to a local copy that would forever be shallow and missing history from the remote.
        // NOTE: Use of git `shallow` file may be useful here to know which commits are known to be missing parents in a local repo, see: https://git-scm.com/docs/shallow
        // To do that, we would have to traverse the commit history at dst until we find the cutoff point, and then resume attempting to sync from there.
        // To do that efficiently, we should consider doing that traversal using as much local data as we have (which could be in either `src` or `dst` depending on the flow), and reducing the amount of data transferred from a remote repo.
        // This would be important to achieve eventual consistency and complete history rehydration after a partial failure e.g. due to out-of-order writes by another party.
        includeInSync = !await dst.hasObject(head.oid);
      }
      else {
        includeInSync = true;
      }

      if (includeInSync) {
        const skipOnError = options.allowShallow && !isTop;

        let commit: CommitObject;
        try {
          commit = await loadCommitObject(src, head.oid);

          // NOTE: This may leave orphaned files in the destination repo (in case we fail before all commit objects have been written, or if we encounter a tree with missing objects).
          // Such orphaned files are harmless (and deleting them could be catastrophic in case another client had also just written them and expects them to stay. Since we cannot be sure nobody else relies on these files, we cannot delete).
          // Deletion would only be possible from a separate, explicit and potentially destructive method to garbage-collect the destination repo.
          await syncTree(src, dst, commit.body.tree, consistency);
        } catch (error) {
          if (skipOnError && error instanceof MissingObjectError) {
            if (head.referencedByCommitIndex !== undefined) {
              allCommits[head.referencedByCommitIndex].shallow = true;
            }
            continue;
          }

          throw error;
        }

        nextHeads.push(...commit.body.parents.map(parent => ({ referencedByCommitIndex: allCommits.length, oid: parent })));
        allCommits.push({
          oid: head.oid,
          shallow: false, // Assume initially that it won't be shallow, but it may become so if we later find an incomplete parent commit
        });
      }
    }

    heads = nextHeads;
  }

  return allCommits;
}

async function syncTree(src: IReadOnlyRepo, dst: IRepo, treeHash: string, consistency: SyncConsistency): Promise<void> {
  //console.log(`Syncing tree ${treeHash}`);
  if (consistency === SyncConsistency.AssumeConnectivity) {
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
