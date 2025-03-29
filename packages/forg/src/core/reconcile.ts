import { ExpandedTree, GitTreeFS, Hash, IRepo } from '../git';
import { ForgClientInfo, HeadInfo } from './model';
import { ReconcileOptions, reconcileCommits } from './reconcileCommits';
import { ForgContainer } from './snapshots/containers/ForgContainer';
import { ForgContainerFactory } from './snapshots/containers/ForgContainerFactory';
import { ForgSnapshot } from './snapshots/ForgSnapshot';


export async function reconcile(repo: IRepo, client: ForgClientInfo, branchName: string, containerFactory: ForgContainerFactory, options?: ReconcileOptions): Promise<Hash> {
  return await reconcileCommits(repo, client, branchName, (repo, a, b, base) => mergeImpl(repo, a, b, base, containerFactory), options);
}

async function mergeImpl(repo: IRepo, a: HeadInfo, b: HeadInfo, base: HeadInfo, containerFactory: ForgContainerFactory): Promise<GitTreeFS> {
  const snapshotA = await ForgSnapshot.create(repo, a, containerFactory)
  const snapshotB = await ForgSnapshot.create(repo, b, containerFactory)
  const snapshotBase = await ForgSnapshot.create(repo, base, containerFactory)

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
    if (a.treeHash === b.treeHash) {
      // They are the same, trivial case. Just take it as-is from either side
      resultContainersTree.entries[name] = a.rootFS.root;
    }
    else {
      if (base !== undefined) {
        // Resolve conflicts (aka merge)
        const reconciledFS = await a.reconcile(b);
        resultContainersTree.entries[name] = reconciledFS.root;
      }
      else {
        // Container was created independently on each side. Resolve by taking the one that was created earlier
        const older = a.head.commit.body.author.date <= b.head.commit.body.author.date ? a : b;
        resultContainersTree.entries[name] = older.rootFS.root;
      }
    }
  }
  else if (base !== undefined) {
    if (base.treeHash === a.treeHash) {
      // Container was deleted in b and was not modified in a. Accept the deletion (i.e. do not include in the results), this is not a conflict

      // Deliberately do nothing, we are not including this container in the results.
    }
    else {
      // Container was modified in a, and deleted in b.
      // This is a conflicting change. For now we resolve the conflict by simply deleting it (i.e. do not include in the results)

      // Deliberately do nothing, we are not including this container in the results.
    }
  }
  else {
    // Container was simply added in a, so keep it.
    resultContainersTree.entries[name] = a.rootFS.root;
  }

  return Promise.resolve();
}
