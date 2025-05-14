import { ExpandedTree, GitTreeFS, Hash, IRepo } from '../git';
import { WorkingTreeEntry } from '../git/db/workingTree'; // TODO: Remove reference to internal details of other package
import { ForgClientInfo, HeadInfo } from './model';
import { ReconcileOptions, reconcileCommits } from './reconcileCommits';
import { ForgContainer } from './snapshots/containers/ForgContainer';
import { ForgContainerMerger } from './snapshots/containers/ForgContainerMerger';
import { ForgSnapshot } from './snapshots/ForgSnapshot';


export async function reconcile(repo: IRepo, client: ForgClientInfo, branchName: string, containerMerger: ForgContainerMerger, options?: ReconcileOptions): Promise<Hash> {
  return await reconcileCommits(repo, client, branchName, (repo, a, b, base) => mergeImpl(repo, a, b, base, containerMerger), options);
}

async function mergeImpl(repo: IRepo, a: HeadInfo, b: HeadInfo, base: HeadInfo, containerMerger: ForgContainerMerger): Promise<GitTreeFS> {
  const snapshotA = await ForgSnapshot.create(repo, a)
  const snapshotB = await ForgSnapshot.create(repo, b)
  const snapshotBase = await ForgSnapshot.create(repo, base)

  const containersTree: ExpandedTree = { type: 'tree', entries: new Map() };
  const resultTree: ExpandedTree = { type: 'tree', entries: new Map<string, WorkingTreeEntry>([['containers', containersTree]]) };
  const result = GitTreeFS.fromWorkingTree(repo, resultTree);

  const processedContainers = new Set<string>();
  for (const containerName of await snapshotA.listContainers()) {
    processedContainers.add(containerName);

    const containerA = await snapshotA.getContainer(containerName);
    const containerB = await snapshotB.getContainerIfExists(containerName);
    const containerBase = await snapshotBase.getContainerIfExists(containerName);

    await reconcileContainer(containerName, containerA, containerB, containerBase, containersTree, containerMerger);
  }

  for (const containerName of await snapshotB.listContainers()) {
    if (processedContainers.has(containerName)) {
      // Already reconciled above
      continue;
    }

    const containerB = await snapshotB.getContainer(containerName);
    const containerBase = await snapshotBase.getContainerIfExists(containerName);

    await reconcileContainer(containerName, containerB, undefined, containerBase, containersTree, containerMerger);
  }

  return result;
}

async function reconcileContainer(name: string, a: ForgContainer, b: ForgContainer | undefined, base: ForgContainer | undefined, resultContainersTree: ExpandedTree, containerMerger: ForgContainerMerger): Promise<void> {
  if (b !== undefined) {
    // Container exists on both sides
    if (a.treeHash === b.treeHash) {
      // They are the same, trivial case. Just take it as-is from either side
      resultContainersTree.entries.set(name, a.rootFS.root);
    }
    else {
      if (base !== undefined) {
        // Resolve conflicts (aka merge)
        const reconciled = await containerMerger.merge(a, b, base);
        resultContainersTree.entries.set(name, reconciled.rootFS.root);
      }
      else {
        // Container was created independently on each side. Resolve by taking the one that was created earlier
        const older = a.head.commit.body.author.date <= b.head.commit.body.author.date ? a : b;
        resultContainersTree.entries.set(name, older.rootFS.root);
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
    resultContainersTree.entries.set(name, a.rootFS.root);
  }

  return Promise.resolve();
}
