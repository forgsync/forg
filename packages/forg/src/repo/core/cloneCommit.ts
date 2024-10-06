import {
  CommitObject,
  Hash,
  IRepo,
  loadCommitObject,
  loadTreeObject,
  Mode,
} from '../git';
import { IReadOnlyRepo } from '../git/internal/Repo';
import { CloneConsistencyOptions, defaultConsistencyOptions, ConsistencyMode } from './consistency';

export async function cloneCommit(src: IReadOnlyRepo, dst: IRepo, commitHash: string, consistency: CloneConsistencyOptions = defaultConsistencyOptions()): Promise<CommitObject> {
  //console.log(`Cloning commit ${commitHash}`);
  if (consistency.headCommit === ConsistencyMode.Skip) {
    throw new Error('Invalid consistency mode Skip for headCommit');
  }

  if (consistency.headCommit < consistency.parentCommits) {
    throw new Error(`Invalid consistency options, expected headCommit (${ConsistencyMode[consistency.headCommit]}) to be higher or equal to parentCommits (${ConsistencyMode[consistency.parentCommits]})`);
  }

  // Step 1: Find all commits via parallel DFS
  const allCommits = new Map<Hash, CommitObject>();
  let heads = [commitHash];
  while (heads.length > 0) {
    const nextHeads: Hash[] = [];
    for (const head of heads) {
      const mode = head === commitHash ? consistency.headCommit : consistency.parentCommits;

      let skip = false;
      if (mode === ConsistencyMode.Skip) {
        skip = true;
      }
      if (mode === ConsistencyMode.OptimisticAssumeConnectivity) {
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
    const mode = curCommitHash === commitHash ? consistency.headCommit : consistency.parentCommits;
    await cloneTree(src, dst, curCommit.body.tree, mode);
    await cloneObject(src, dst, curCommitHash, mode);
  }

  const commit = allCommits.get(commitHash);
  if (commit === undefined) {
    throw new Error(); // coding defect
  }

  return commit;
}

async function cloneTree(src: IReadOnlyRepo, dst: IRepo, treeHash: string, consistency: ConsistencyMode) {
  //console.log(`Cloning tree ${treeHash}`);
  if (consistency === ConsistencyMode.OptimisticAssumeConnectivity) {
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
      await cloneTree(src, dst, hash, consistency);
    } else {
      await cloneObject(src, dst, hash, consistency);
    }
  }

  // Important: copy the tree object last, so that all of its dependencies were already copied before it.
  await cloneObject(src, dst, treeHash, consistency);
}

async function cloneObject(src: IReadOnlyRepo, dst: IRepo, hash: Hash, consistency: ConsistencyMode) {
  //console.log(`Cloning object ${hash}`);
  if (consistency <= ConsistencyMode.OptimisticAssumeObjectIntegrity) {
    if (await dst.hasObject(hash)) {
      return;
    }
  }

  const raw = await src.loadRawObject(hash);
  await dst.saveRawObject(hash, raw);
}
