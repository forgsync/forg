import { ExpandedTree, GitTreeFS, Hash, IRepo } from '../git';
import { ForgClientInfo } from './model';
import { ReconcileOptions, reconcileTrees } from './reconcileTrees';
import { ForgContainer } from './snapshots/containers/ForgContainer';
import { ForgContainerFactory } from './snapshots/containers/ForgContainerFactory';
import { ForgSnapshot } from './snapshots/ForgSnapshot';


export async function reconcile(repo: IRepo, client: ForgClientInfo, branchName: string, containerFactory: ForgContainerFactory, options?: ReconcileOptions): Promise<Hash> {
  return await reconcileTrees(repo, client, branchName, (a, b, base) => reconcileSnapshots(repo, a, b, base, containerFactory), options);
}

async function reconcileSnapshots(repo: IRepo, a: GitTreeFS, b: GitTreeFS, base: GitTreeFS, containerFactory: ForgContainerFactory): Promise<GitTreeFS> {
  const snapshotA = new ForgSnapshot(a, containerFactory)
  const snapshotB = new ForgSnapshot(b, containerFactory)
  const snapshotBase = new ForgSnapshot(base, containerFactory)

  const containersTree: ExpandedTree = { type: 'tree', entries: {} };
  const resultTree: ExpandedTree = { type: 'tree', entries: { 'containers': containersTree } };
  const result = GitTreeFS.fromWorkingTree(repo, resultTree);

  const processedContainers = new Set<string>();
  for (const containerName of await snapshotA.listContainers()) {
    processedContainers.add(containerName);

    const containerA = await snapshotA.getContainer(containerName);
    const containerB = await snapshotB.getContainerIfExists(containerName);
    const containerBase = await snapshotBase.getContainerIfExists(containerName);

    await reconcileContainer(containerName, containerA, containerB, containerBase, containersTree);
  }

  for (const containerName of await snapshotB.listContainers()) {
    if (processedContainers.has(containerName)) {
      // Already reconciled above
      continue;
    }

    const containerB = await snapshotB.getContainer(containerName);
    const containerBase = await snapshotBase.getContainerIfExists(containerName);

    await reconcileContainer(containerName, containerB, undefined, containerBase, containersTree);
  }

  return result;
}

async function reconcileContainer(name: string, a: ForgContainer, b: ForgContainer | undefined, base: ForgContainer | undefined, resultContainersTree: ExpandedTree): Promise<void> {
  if (b !== undefined) {
    // Container exists on both sides
    if (a.hash === b.hash) {
      // They are the same, trivial case. Just take it as-is from either side
      resultContainersTree.entries[name] = a.rootFS.root;
    }
    else {
      // Resolve conflicts (aka merge)
      const reconciledFS = await a.reconcile(b);
      resultContainersTree.entries[name] = reconciledFS.root;
    }
  }
  else if (base !== undefined) {
    // Container was deleted in b, but existed at the base.
    // This is a conflicting change. For now we resolve the conflict by simply deleting it (i.e. do not include in the results)
  }
  else {
    // Container was simply added in a, so keep it.
    resultContainersTree.entries[name] = a.rootFS.root;
  }

  return Promise.resolve();
}
