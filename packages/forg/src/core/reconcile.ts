import { CommitObject, createCommit, Hash, IRepo, loadCommitObject, loadTreeObject, MissingObjectError, updateRef } from '../git';
import { GitTreeFS } from '../treefs';
import createCommitterInfo from './createCommitterInfo';
import { isTreeFullyReachable } from './internal/isTreeFullyReachable';
import { listForgRefs } from './internal/listForgRefs';
import { mergeBase } from './internal/mergeBase';
import { ForgClientInfo } from './model';

interface ReconcileOptions {
  /**
   * Whether to assume that the repo is well formed, in which case we can speed things up and skipping connectivity checks
   * (i.e. we can assume that the commit pointed to by a ref is available in the repo, and that all of its dependencies (trees, blobs, parent commits) are as well.
   */
  assumeConsistentRepo?: boolean;
}

type MergeFunc = (a: GitTreeFS, b: GitTreeFS, base: GitTreeFS | undefined) => Promise<GitTreeFS>;
export async function reconcile(repo: IRepo, forgClient: ForgClientInfo, branchName: string, merge: MergeFunc, options: ReconcileOptions): Promise<Hash> {
  const assumeConsistentRepo = options?.assumeConsistentRepo ?? false;

  const heads = await listForgRefs(repo, branchName, assumeConsistentRepo);
  const myHead = heads.find((h) => h.clientUuid === forgClient.uuid);
  const myRef = `refs/remotes/${forgClient.uuid}/${branchName}`;

  const { leafCommitIds } = await mergeBase(
    repo,
    heads.map((h) => h.commitId),
  );
  const commitsToReconcile: {
    clientUuid: string | undefined;
    commitId: string;
    commit: CommitObject;
  }[] = [];
  for (const leafCommitId of leafCommitIds) {
    const commit = await loadCommitObject(repo, leafCommitId);

    // Try to pick the correct head, not just the first one that matches the commit id
    // (a remote's commit could appear in another's after that remote did reconciliation).
    // We try to extract clientUuid from the author name, but that has not been standardized yet,
    // so we still fallback to first match by commit id if we don't get a perfect match.
    // In any case, this only matters for the resulting reconciliation commit message, and not for correctness.
    let head = heads.find((h) => h.commitId === leafCommitId && h.clientUuid === commit.body.author.name);
    if (head === undefined) {
      head = heads.find((h) => h.commitId === leafCommitId);
      if (head === undefined) {
        throw new Error(); // coding defect
      }
    }

    commitsToReconcile.push({
      clientUuid: head.clientUuid,
      commitId: head.commitId,
      commit: commit,
    });
  }

  if (commitsToReconcile.length === 0) {
    // Nothing in the repo, reconciliation doesn't make sense yet...
    throw new Error(`Repo has no root commits for forg branch ${branchName}`);
  } else if (commitsToReconcile.length === 1) {
    if (myHead === undefined || myHead.commitId !== commitsToReconcile[0].commitId) {
      // Trivial case -- just set our head to the only available possibility
      const kind = myHead === undefined ? 'initial' : 'fast-forward';
      await updateRef(
        repo,
        myRef,
        commitsToReconcile[0].commitId,
        createCommitterInfo(forgClient),
        `reconcile (${kind}): ${commitsToReconcile[0].clientUuid}`,
      );
    }

    return commitsToReconcile[0].commitId;
  }

  // Reconcile older commits first
  commitsToReconcile.sort((a, b) => {
    const authorA = a.commit.body.author;
    const authorB = b.commit.body.author;
    let v = authorA.date.seconds - authorB.date.seconds;
    if (v !== 0) {
      return v;
    }

    if (a.commitId < b.commitId) {
      return -1;
    } else if (a.commitId > b.commitId) {
      return 1;
    }

    return 0;
  });

  let prev: Hash = commitsToReconcile[0].commitId;
  for (let i = 1; i < commitsToReconcile.length; i++) {
    const commitIdA = prev;
    const commitIdB = commitsToReconcile[i].commitId;

    const treeA = await getWorkingTree(repo, commitIdA);
    const treeB = await getWorkingTree(repo, commitIdB);
    const baseTree = await tryGetBaseWorkingTree(repo, commitIdA, commitIdB, assumeConsistentRepo);

    const newTree = await merge(treeA, treeB, baseTree);
    prev = await createCommit(
      repo,
      newTree.root,
      [commitIdA, commitIdB],
      `Reconcile forg clients ${commitsToReconcile
        .slice(0, i + 1)
        .map((h) => h.clientUuid)
        .join(', ')}`,
      createCommitterInfo(forgClient),
    );
  }

  await updateRef(
    repo,
    myRef,
    prev,
    createCommitterInfo(forgClient),
    `reconcile: ${commitsToReconcile.map((h) => h.clientUuid).join(', ')}`,
  );

  return prev;
}

async function getWorkingTree(repo: IRepo, commitId: Hash): Promise<GitTreeFS> {
  const commit = await loadCommitObject(repo, commitId);
  const tree = await loadTreeObject(repo, commit.body.tree);
  return GitTreeFS.fromTree(repo, tree);
}

async function tryGetBaseWorkingTree(repo: IRepo, commitIdA: string, commitIdB: string, assumeConsistentRepo: boolean): Promise<GitTreeFS | undefined> {
  const { bestAncestorCommitIds } = await mergeBase(repo, [commitIdA, commitIdB]);
  let baseTree: GitTreeFS | undefined = undefined;
  if (bestAncestorCommitIds.length > 0) {
    // If there is more than one, pick one arbitrarily...
    const baseCommitId = bestAncestorCommitIds[0];

    try {
      const baseCommit = await loadCommitObject(repo, baseCommitId);
      if (assumeConsistentRepo || await isTreeFullyReachable(repo, baseCommit.body.tree)) {
        // TODO: Avoid reloading the same objects so many times, we already loaded the tree above
        const tree = await loadTreeObject(repo, baseCommit.body.tree);
        baseTree = GitTreeFS.fromTree(repo, tree);
      }
      else {
        // Try to keep going, if merge func can work without a base, let it try its thing...
      }
    }
    catch (error) {
      if (error instanceof MissingObjectError) {
        // Try to keep going, if merge func can work without a base, let it try its thing...
      }
      else {
        throw error;
      }
    }
  }

  return baseTree;
}
