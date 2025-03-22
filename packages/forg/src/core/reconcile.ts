import { ExpandedTree, GitTreeFS, Hash, IRepo } from '../git';
import { ForgClientInfo } from './model';
import { ReconcileOptions, reconcileTrees } from './reconcileTrees';
import { ForgContainerFactory } from './snapshots/containers/ForgContainerFactory';
import { ForgSnapshot } from './snapshots/ForgSnapshot';


export async function reconcile(repo: IRepo, client: ForgClientInfo, branchName: string, containerFactory: ForgContainerFactory, options?: ReconcileOptions): Promise<Hash> {
  return await reconcileTrees(repo, client, branchName, (a, b, base) => reconcileSnapshots(repo, a, b, base, containerFactory), options);
}

async function reconcileSnapshots(repo: IRepo, a: GitTreeFS, b: GitTreeFS, base: GitTreeFS, containerFactory: ForgContainerFactory): Promise<GitTreeFS> {
  const [snapshotA, containersA] = await prepare(a, containerFactory);
  const [snapshotB, containersB] = await prepare(b, containerFactory);
  const [snapshotBase, containersBase] = await prepare(base, containerFactory);

  const resultTree: ExpandedTree = { type: 'tree', entries: {} };
  const result = GitTreeFS.fromWorkingTree(repo, resultTree);

  for (const containerName of containersA) {
    const containerA = await snapshotA.getContainer(containerName);

    if (containersB.has(containerName)) {
      const containerB = await snapshotB.getContainer(containerName);

      if (containerA.hash !== containerB.hash) {
        // TODO: Merge containers. Use base if appropriate
      }
    }
    else {
      if (containersBase.has(containerName)) {
        // Container was deleted in B.
        const containerBase = await snapshotBase.getContainer(containerName);
        if (containerBase.hash !== containerA.hash) {
          // Container was modified in A, and deleted in B.
          // TODO: Handle conflict. For now we just delete.
        }
        else {
          // Container was deleted in B, and not modified in A. Easy case, just remove it.
          // TODO: Remove from results
        }
      }
      else {
        // A added it, so we keep it
        // TODO: Include it in results
      }
    }
  }

  for (const containerName of containersB) {
    const containerB = await snapshotB.getContainer(containerName);
    if (containersA.has(containerName)) {
      // We already handled merges above, do nothing now...
    }
    else {
      if (containersBase.has(containerName)) {
        // Container was deleted in A
        const containerBase = await snapshotBase.getContainer(containerName);
        if (containerBase.hash !== containerB.hash) {
          // Container was modified in B, and deleted in A.
          // TODO: Handle conflict. Probably we should just keep B.
        }
        else {
          // Container was deleted in A, and not modified in B. Easy case, just remove it.
          // TODO: Remove from results
        }
      }
      else {
        // B added it, so we keep it
        // TODO: Include it in results
      }
    }
  }

  return result;
}

async function prepare(containerRoot: GitTreeFS, containerFactory: ForgContainerFactory): Promise<[snapshot: ForgSnapshot, containers: Set<string>]> {
  const snapshot = new ForgSnapshot(containerRoot, containerFactory);
  const containers = new Set<string>(await snapshot.listContainers());
  return [snapshot, containers];
}
