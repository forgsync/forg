import { CommitObject, createCommit, GitTreeFS, Hash, IRepo, loadCommitObject, loadTreeObject, Person, updateRef } from '../git';
import createCommitterInfo from './createCommitterInfo';
import { formatForgRef } from './internal/formatForgRef';
import { listForgRefs } from './internal/listForgRefs';
import { mergeBase } from './internal/mergeBase';
import { ForgClientInfo } from './model';

export interface ReconcileOptions {
  /**
   * Whether to assume that the repo is well formed.
   * Generally this should be set to true when you are operating on a local repo whose integrity is guaranteed, in which case we can speed things up by skipping connectivity checks
   * (i.e. we can assume that commits pointed to by refs are available in the repo, and that all of their dependencies (trees, blobs, parent commits) are as well.
   * If you are using forg against a remote repo directly that the current client doesn't fully control, then it is best to set this to false (default).
   */
  assumeConsistentRepo?: boolean;
}

interface CommitToReconcile {
  author: string;
  commitId: string;
  commit: CommitObject;
}

type MergeFunc = (a: GitTreeFS, b: GitTreeFS, base: GitTreeFS) => Promise<GitTreeFS>;
export async function reconcileTrees(repo: IRepo, client: ForgClientInfo, branchName: string, merge: MergeFunc, options?: ReconcileOptions): Promise<Hash> {
  const assumeConsistentRepo = options?.assumeConsistentRepo ?? false;
  const { resolvedRefs, commitsToReconcile } = await getCommitsToReconcile(repo, branchName, assumeConsistentRepo);

  const myResolvedRef = resolvedRefs.find((h) => h.clientUuid === client.uuid);
  const myRef = formatForgRef({ branchName, client });
  const commiter = createCommitterInfo(client);

  if (commitsToReconcile.length === 0) {
    // Nothing in the repo, reconciliation doesn't make sense yet...
    throw new Error(`Repo has no root commits for forg branch ${branchName}`);
  } else if (commitsToReconcile.length === 1) {
    // Trivial case -- nothing to merge, we found a specific commit that is itself the reconciled state

    if (myResolvedRef !== undefined && myResolvedRef.commitId === commitsToReconcile[0].commitId) {
      // All good, our ref is already there!
    }
    else {
      // We just need to set our ref there
      const kind = myResolvedRef === undefined ? 'initial' : 'fast-forward';
      await updateRef(
        repo,
        myRef,
        commitsToReconcile[0].commitId,
        commiter,
        `reconcile (${kind}): ${commitsToReconcile[0].author}`,
      );
    }

    return commitsToReconcile[0].commitId;
  }

  // Reconcile older commits first
  commitsToReconcile.sort(commitSorter);

  let prev: Hash = commitsToReconcile[0].commitId;
  for (let i = 1; i < commitsToReconcile.length; i++) {
    const commitMessage = `Reconcile forg clients ${commitsToReconcile.slice(0, i + 1).map((h) => h.author).join(', ')}`;
    prev = await reconcileCommits(
      repo,
      prev,
      commitsToReconcile[i].commitId,
      merge,
      commiter, commitMessage);
  }

  await updateRef(
    repo,
    myRef,
    prev,
    commiter,
    `reconcile: ${commitsToReconcile.map((h) => h.author).join(', ')}`,
  );

  return prev;
}

async function getCommitsToReconcile(repo: IRepo, branchName: string, assumeConsistentRepo: boolean) {
  const resolvedRefs = await listForgRefs(repo, branchName, assumeConsistentRepo);
  const { leafCommitIds } = await mergeBase(
    repo,
    resolvedRefs.map((h) => h.commitId),
  );
  const commitsToReconcile: CommitToReconcile[] = [];
  for (const leafCommitId of leafCommitIds) {
    const commit = await loadCommitObject(repo, leafCommitId);
    commitsToReconcile.push({
      author: commit.body.author.name,
      commitId: leafCommitId,
      commit: commit,
    });
  }

  return { resolvedRefs, commitsToReconcile };
}

async function reconcileCommits(repo: IRepo, commitIdA: Hash, commitIdB: Hash, merge: MergeFunc, committer: Person, commitMessage: string): Promise<Hash> {
  const treeA = await getWorkingTree(repo, commitIdA);
  const treeB = await getWorkingTree(repo, commitIdB);
  const baseTree = await getBaseWorkingTree(repo, commitIdA, commitIdB);

  let newTree: GitTreeFS;
  try {
    newTree = await merge(treeA, treeB, baseTree);
  }
  catch (error) {
    if (treeA.isMissingObjects || treeB.isMissingObjects || baseTree.isMissingObjects) {
      // TODO: How to handle this? Perhaps try different commits, either from the commit history or from the reflog?
      throw new Error('Reconcile failed due to missing objects');
    }

    throw error;
  }

  return await createCommit(
    repo,
    newTree.root,
    [commitIdA, commitIdB],
    commitMessage,
    committer
  );
}

async function getWorkingTree(repo: IRepo, commitId: Hash): Promise<GitTreeFS> {
  const commit = await loadCommitObject(repo, commitId);
  const tree = await loadTreeObject(repo, commit.body.tree);
  return GitTreeFS.fromTree(repo, tree);
}

async function getBaseWorkingTree(repo: IRepo, commitIdA: string, commitIdB: string): Promise<GitTreeFS> {
  const { bestAncestorCommitIds } = await mergeBase(repo, [commitIdA, commitIdB]);
  if (bestAncestorCommitIds.length === 0) {
    throw new Error('No base commit found');
  }

  return await getWorkingTree(repo, bestAncestorCommitIds[0]);
}

function commitSorter(a: CommitToReconcile, b: CommitToReconcile): number {
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
}
