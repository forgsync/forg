import {
  CommitObject,
  Hash,
  IRepo,
  loadCommitObject,
  loadTreeObject,
  Mode,
} from '../git';
import { IReadOnlyRepo } from '../git/internal/Repo';
import { SyncConsistencyOptions, defaultConsistencyOptions, ConsistencyMode } from './consistency';

/**
 * Low level primitive used to sync a commit and its dependencies between repo's.
 * This implementation regardless of whether `src` / `dst` are local / remote repo's, and as such this is used both for both `fetch` and `forcePush`.
 */
export async function syncCommit(src: IReadOnlyRepo, dst: IRepo, commitHash: string, consistency: SyncConsistencyOptions = defaultConsistencyOptions()): Promise<CommitObject> {
  //console.log(`Syncing commit ${commitHash}`);
  if (consistency.headCommitConsistency === ConsistencyMode.Skip) {
    throw new Error(`Invalid headCommitConsistency consistency mode (${ConsistencyMode[consistency.headCommitConsistency]})`);
  }

  if (consistency.headCommitConsistency < consistency.parentCommitsConsistency) {
    throw new Error(
      `Invalid consistency options, expected headCommitConsistency (${ConsistencyMode[consistency.headCommitConsistency]}) ` +
      `to be higher or equal to parentCommitsConsistency (${ConsistencyMode[consistency.parentCommitsConsistency]})`);
  }

  // Step 1: Find all commits via parallel DFS
  const allCommits = new Map<Hash, CommitObject>();
  let heads = [commitHash];
  while (heads.length > 0) {
    const nextHeads: Hash[] = [];
    for (const head of heads) {
      const mode = head === commitHash ? consistency.headCommitConsistency : consistency.parentCommitsConsistency;

      let skip = false;
      if (mode === ConsistencyMode.Skip) {
        skip = true;
      }
      if (mode === ConsistencyMode.AssumeConnectivity) {
        if (await dst.hasObject(head)) {
          // Commit already exists in the destination and we are assuming connectivity, so all of its dependencies (parent commits, trees, blobs) are assumed to also exist in the destination.
          // We can stop this traversal...
          skip = true;
        }
      }

      // Even if we decided to skip, still need to load the commit object in case this was the first commit, since we need to return the commit object in the end
      if (!skip || head === commitHash) {
        const commit = await loadCommitObject(src, head);
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
    const mode = curCommitHash === commitHash ? consistency.headCommitConsistency : consistency.parentCommitsConsistency;
    await syncTree(src, dst, curCommit.body.tree, mode);
    await syncObject(src, dst, curCommitHash, mode);
  }

  const commit = allCommits.get(commitHash);
  if (commit === undefined) {
    throw new Error(); // coding defect
  }

  return commit;
}

async function syncTree(src: IReadOnlyRepo, dst: IRepo, treeHash: string, consistency: ConsistencyMode) {
  //console.log(`Syncing tree ${treeHash}`);
  if (consistency === ConsistencyMode.AssumeConnectivity) {
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

async function syncObject(src: IReadOnlyRepo, dst: IRepo, hash: Hash, consistency: ConsistencyMode) {
  //console.log(`Syncing object ${hash}`);
  if (consistency <= ConsistencyMode.AssumeObjectIntegrity) {
    if (await dst.hasObject(hash)) {
      return;
    }
  }

  const raw = await src.loadRawObject(hash);
  await dst.saveRawObject(hash, raw);
}
