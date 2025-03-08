import { GitTreeFS, Hash, IRepo } from '../git';
import { ForgClientInfo } from './model';
import { ReconcileOptions, reconcileTrees } from './reconcileTrees';
import { ForgContainerFactory } from './snapshots/containers/ForgContainerFactory';
import { ForgSnapshot } from './snapshots/ForgSnapshot';


export async function reconcile(repo: IRepo, client: ForgClientInfo, branchName: string, containerFactory: ForgContainerFactory, options?: ReconcileOptions): Promise<Hash> {
  return await reconcileTrees(repo, client, branchName, (a, b, base) => reconcileSnapshots(a, b, base, containerFactory), options);
}

async function reconcileSnapshots(a: GitTreeFS, b: GitTreeFS, base: GitTreeFS, containerFactory: ForgContainerFactory): Promise<GitTreeFS> {
  const [snapshotA, containersA] = await prepare(a, containerFactory);
  const [snapshotB, containersB] = await prepare(b, containerFactory);
  const [snapshotBase, containersBase] = await prepare(base, containerFactory);

  for (const containerName of containersA) {
    if (containersB.has(containerName)) {
      const containerA = await snapshotA.getContainer(containerName);
      const containerB = await snapshotB.getContainer(containerName);
      // TODO: Merge containers
    }
    else {
      if (containersBase.has(containerName)) {
        // Container was deleted in B. But it might also have been modified in A.
        // For now, we simply delete it, but this could lead to data loss.
        // TODO: Remove from results
      }
      else {
        // A added it, so we keep it
        // TODO: Include it in results
      }
    }
  }

  for (const containerName of containersB) {
    if (containersA.has(containerName)) {
      // We already handled merges above, do nothing now...
    }
    else {
      if (containersBase.has(containerName)) {
        // Container was deleted in A. But it might also have been modified in B.
        // For now, we simply delete it, but this could lead to data loss.
        // TODO: Remove from results
      }
      else {
        // B added it, so we keep it
        // TODO: Include it in results
      }
    }
  }
  return a;
}

async function prepare(containerRoot: GitTreeFS, containerFactory: ForgContainerFactory): Promise<[snapshot: ForgSnapshot, containers: Set<string>]> {
  const snapshot = new ForgSnapshot(containerRoot, containerFactory);
  const containers = new Set<string>(await snapshot.listContainers());
  return [snapshot, containers];
}
