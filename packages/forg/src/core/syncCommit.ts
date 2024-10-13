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
import { SyncOptions, SyncConsistencyMode } from "./model";

/**
 * Low level primitive used to sync a commit and its dependencies between repo's.
 * This implementation is symmetric regardless of whether `src` / `dst` are local / remote repo's, and as such this is used both for both `fetch` and `forcePush`.
 */
export async function syncCommit(src: IReadOnlyRepo, dst: IRepo, commitHash: string, options: SyncOptions = defaultSyncConsistencyOptions()): Promise<CommitObject> {
  //console.log(`Syncing commit ${commitHash}`);
  if (options.topCommitConsistency === SyncConsistencyMode.Skip) {
    throw new Error(`Invalid headCommitConsistency consistency mode (${SyncConsistencyMode[options.topCommitConsistency]})`);
  }

  if (options.topCommitConsistency < options.otherCommitsConsistency) {
    throw new Error(
      `Invalid consistency options, expected headCommitConsistency (${SyncConsistencyMode[options.topCommitConsistency]}) ` +
      `to be higher or equal to parentCommitsConsistency (${SyncConsistencyMode[options.otherCommitsConsistency]})`);
  }

  // Step 1: Find all commits via parallel DFS
  const allCommits = new Map<Hash, CommitObject>();
  let heads = [commitHash];
  while (heads.length > 0) {
    const nextHeads: Hash[] = [];
    for (const head of heads) {
      const isTop = head === commitHash;
      const mode = isTop ? options.topCommitConsistency : options.otherCommitsConsistency;

      let skip = false;
      if (mode === SyncConsistencyMode.Skip) {
        skip = true;
      }
      else if (mode === SyncConsistencyMode.AssumeConnectivity) {
        if (await dst.hasObject(head)) {
          // Commit already exists in the destination and we are assuming connectivity, so all of its dependencies (parent commits, trees, blobs) are assumed to also exist in the destination.
          // We can stop this traversal...
          skip = true;
        }
      }

      // Even if we decided to skip, still need to load the commit object in case this was the first commit, since we need to return the commit object in the end
      // TODO: Refactor, this has become a bit unwieldy
      if (!skip || isTop) {
        const skipOnError = options.allowShallow && !isTop;

        let commit: CommitObject;
        try {
          commit = await loadCommitObject(src, head);
        } catch (error) {
          if (skipOnError && error instanceof MissingObjectError) {
            continue;
          }

          throw error;
        }
        allCommits.set(head, commit);
        if (!skip) {
          nextHeads.push(...commit.body.parents);
        }
      }
    }

    heads = nextHeads;
  }

  // Step 2: Go backwards through all commits we decided to scan. It is important to go backwards so that the objects are always connected at all times, including in case of an unexpected exit
  // (i.e. we never store an object until all dependencies are stored)
  for (const [curCommitHash, curCommit] of Array.from(allCommits).reverse()) {
    const isTop = curCommitHash === commitHash;
    const mode = isTop ? options.topCommitConsistency : options.otherCommitsConsistency;

    const skipOnError = options.allowShallow && !isTop;
    try {
      // NOTE: This may leave some orphaned files in the destination repo (when skipOnError is true), but they are harmless
      // (and deleting them could be catastrophic in case another client had also just written them and expects them to stay. Since we cannot be sure nobody else relies on these files, we cannot delete).
      // Deletion would only be possible from a separate, explicit and potentially destructive method to garbage-collect the destination repo.
      await syncTree(src, dst, curCommit.body.tree, mode);
      await syncObject(src, dst, curCommitHash, mode);
    }
    catch (error) {
      if (skipOnError && error instanceof MissingObjectError) {
        continue;
      }

      throw error;
    }
  }

  const commit = allCommits.get(commitHash);
  if (commit === undefined) {
    throw new Error(); // coding defect
  }

  return commit;
}

async function syncTree(src: IReadOnlyRepo, dst: IRepo, treeHash: string, consistency: SyncConsistencyMode) {
  //console.log(`Syncing tree ${treeHash}`);
  if (consistency === SyncConsistencyMode.AssumeConnectivity) {
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

async function syncObject(src: IReadOnlyRepo, dst: IRepo, hash: Hash, consistency: SyncConsistencyMode) {
  //console.log(`Syncing object ${hash}`);
  if (consistency <= SyncConsistencyMode.AssumeObjectIntegrity) {
    if (await dst.hasObject(hash)) {
      return;
    }
  }

  const raw = await src.loadRawObject(hash);
  await dst.saveRawObject(hash, raw);
}

function defaultSyncConsistencyOptions(): SyncOptions {
  return {
    topCommitConsistency: SyncConsistencyMode.AssumeConnectivity,
    otherCommitsConsistency: SyncConsistencyMode.AssumeConnectivity,
    allowShallow: true,
  };
}
