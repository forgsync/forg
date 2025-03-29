import { createCommit, GitTreeFS, Hash, IRepo, loadCommitObject, Person, updateRef } from '../git';
import createCommitterInfo from './createCommitterInfo';
import { formatForgRef } from './internal/formatForgRef';
import { listForgRefs } from './internal/listForgRefs';
import { mergeBase } from './internal/mergeBase';
import { ForgClientInfo, HeadInfo } from './model';

export interface ReconcileOptions {
  /**
   * Whether to assume that the repo is well formed.
   * Generally this should be set to true when you are operating on a local repo whose integrity is guaranteed, in which case we can speed things up by skipping connectivity checks
   * (i.e. we can assume that commits pointed to by refs are available in the repo, and that all of their dependencies (trees, blobs, parent commits) are as well.
   * If you are using forg against a remote repo directly that the current client doesn't fully control, then it is best to set this to false (default).
   */
  assumeConsistentRepo?: boolean;
}

export enum MergeSideErrno {
  MissingObjects,
}
export class MergeError extends Error {
  readonly errnoA: MergeSideErrno | undefined;
  readonly errnoB: MergeSideErrno | undefined;
  readonly errnoBase: MergeSideErrno | undefined;

  constructor(errnoA: MergeSideErrno | undefined, errnoB: MergeSideErrno | undefined, errnoBase: MergeSideErrno | undefined, details?: string) {
    super(details);
    this.errnoA = errnoA;
    this.errnoB = errnoB;
    this.errnoBase = errnoBase;
  }
}
/**
 * Merges the heads specified and produced a new tree that represents the merge results to be committed.
 * If merge fails in a graceful way, it should throw a `MergeError`.
 */
type MergeFunc = (repo: IRepo, a: HeadInfo, b: HeadInfo, base: HeadInfo) => Promise<GitTreeFS>;

export async function reconcileCommits(repo: IRepo, client: ForgClientInfo, branchName: string, mergeFunc: MergeFunc, options?: ReconcileOptions): Promise<Hash> {
  const assumeConsistentRepo = options?.assumeConsistentRepo ?? false;
  const { resolvedRefs, commitsToReconcile } = await getCommitsToMerge(repo, branchName, assumeConsistentRepo);

  const myResolvedRef = resolvedRefs.find((h) => h.clientUuid === client.uuid);
  const myRef = formatForgRef({ branchName, client });
  const commiter = createCommitterInfo(client);

  if (commitsToReconcile.length === 0) {
    // Nothing in the repo, reconciliation doesn't make sense yet...
    throw new Error(`Repo has no root commits for forg branch ${branchName}`);
  } else if (commitsToReconcile.length === 1) {
    // Trivial case -- nothing to merge, we found a specific commit that is itself the reconciled state

    if (myResolvedRef !== undefined && myResolvedRef.commitId === commitsToReconcile[0].hash) {
      // All good, our ref is already there!
    }
    else {
      // We just need to set our ref there
      const kind = myResolvedRef === undefined ? 'initial' : 'fast-forward';
      await updateRef(
        repo,
        myRef,
        commitsToReconcile[0].hash,
        commiter,
        `reconcile (${kind}): ${commitsToReconcile[0].commit.body.author}`,
      );
    }

    return commitsToReconcile[0].hash;
  }

  // Reconcile older commits first
  commitsToReconcile.sort(commitSorter);

  let prev: Hash = commitsToReconcile[0].hash;
  for (let i = 1; i < commitsToReconcile.length; i++) {
    const commitMessage = `Reconcile forg clients ${commitsToReconcile.slice(0, i + 1).map((h) => h.commit.body.author).join(', ')}`;
    prev = await mergeCommits(
      repo,
      prev,
      commitsToReconcile[i].hash,
      mergeFunc,
      commiter, commitMessage);
  }

  await updateRef(
    repo,
    myRef,
    prev,
    commiter,
    `reconcile: ${commitsToReconcile.map((h) => h.commit.body.author).join(', ')}`,
  );

  return prev;
}

async function getCommitsToMerge(repo: IRepo, branchName: string, assumeConsistentRepo: boolean) {
  const resolvedRefs = await listForgRefs(repo, branchName, assumeConsistentRepo);
  const { leafCommitIds } = await mergeBase(
    repo,
    resolvedRefs.map((h) => h.commitId),
  );
  const commitsToReconcile: HeadInfo[] = [];
  for (const leafCommitId of leafCommitIds) {
    const commit = await loadCommitObject(repo, leafCommitId);
    commitsToReconcile.push({
      hash: leafCommitId,
      commit: commit,
    });
  }

  return { resolvedRefs, commitsToReconcile };
}

async function mergeCommits(repo: IRepo, commitIdA: Hash, commitIdB: Hash, mergeFunc: MergeFunc, committer: Person, commitMessage: string): Promise<Hash> {
  const headA = await getHeadInfo(repo, commitIdA);
  const headB = await getHeadInfo(repo, commitIdB);
  const headBase = await getBaseHeadInfo(repo, commitIdA, commitIdB);

  let newTree: GitTreeFS;
  try {
    newTree = await mergeFunc(repo, headA, headB, headBase);
  }
  catch (error) {
    if (error instanceof MergeError) {
      if (error.errnoA === MergeSideErrno.MissingObjects || error.errnoB === MergeSideErrno.MissingObjects || error.errnoBase === MergeSideErrno.MissingObjects) {
        // TODO: How to handle this? Perhaps try different commits, either from the commit history or from the reflog?
        throw new Error('Reconcile failed due to missing objects');
      }
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

async function getHeadInfo(repo: IRepo, commitId: Hash): Promise<HeadInfo> {
  const commit = await loadCommitObject(repo, commitId);
  return { hash: commitId, commit };
}

async function getBaseHeadInfo(repo: IRepo, commitIdA: string, commitIdB: string): Promise<HeadInfo> {
  const { bestAncestorCommitIds } = await mergeBase(repo, [commitIdA, commitIdB]);
  if (bestAncestorCommitIds.length === 0) {
    throw new Error(`No base commit found between ${commitIdA}..${commitIdB}`);
  }

  return await getHeadInfo(repo, bestAncestorCommitIds[0]);
}

function commitSorter(a: HeadInfo, b: HeadInfo): number {
  const authorA = a.commit.body.author;
  const authorB = b.commit.body.author;
  let v = authorA.date.seconds - authorB.date.seconds;
  if (v !== 0) {
    return v;
  }

  if (a.hash < b.hash) {
    return -1;
  } else if (a.hash > b.hash) {
    return 1;
  }

  return 0;
}
