import {
  createCommit,
  ExpandedTree,
  Hash,
  IRepo,
  loadCommitObject,
  loadTreeObject,
  Person,
  treeToWorkingTree,
  updateRef,
} from '../git';
import { isTreeFullyReachable } from './internal/isTreeFullyReachable';
import { ForgClientHead, listForgHeads } from './internal/listForgHeads';
import { mergeBase } from './internal/mergeBase';
import { ForgClientInfo } from './model';

type MergeFunc = (a: ExpandedTree, b: ExpandedTree, base: ExpandedTree | undefined) => Promise<ExpandedTree>;
export async function reconcile(
  repo: IRepo,
  forgClient: ForgClientInfo,
  branchName: string,
  merge: MergeFunc,
): Promise<Hash> {
  const heads = await listForgHeads(repo, branchName);
  const myHead = heads.find((h) => h.clientUuid === forgClient.uuid);
  const myRef = `refs/remotes/${forgClient.uuid}/${branchName}`;

  const mergeResults = await mergeBase(
    repo,
    heads.map((h) => h.head.hash),
  );
  const leafHeads: ForgClientHead[] = [];
  for (const leafCommitId of mergeResults.leafCommitIds) {
    const head = heads.find((h) => h.head.hash === leafCommitId);
    if (head === undefined) {
      throw new Error(); // coding defect
    }

    leafHeads.push(head);
  }

  if (leafHeads.length === 0) {
    // Nothing in the repo, reconciliation doesn't make sense yet...
    throw new Error(`Repo has no root commits for forg branch ${branchName}`);
  } else if (leafHeads.length === 1) {
    if (myHead === undefined || myHead.head.hash !== leafHeads[0].head.hash) {
      // Trivial case -- just set our head to the only available possibility
      await updateRef(
        repo,
        myRef,
        mergeResults.leafCommitIds[0],
        createCommitterInfo(forgClient),
        `reconcile (fast-forward): ${leafHeads[0].clientUuid}`,
      );
    }

    return leafHeads[0].head.hash;
  }

  // Reconcile older commits first
  leafHeads.sort((a, b) => {
    const authorA = a.head.commit.body.author;
    const authorB = b.head.commit.body.author;
    let v = authorA.date.seconds - authorB.date.seconds;
    if (v !== 0) {
      return v;
    }

    if (authorA.name < authorB.name) {
      return -1;
    } else if (authorA.name > authorB.name) {
      return 1;
    }

    if (a.head.commit.body.message < b.head.commit.body.message) {
      return -1;
    } else if (a.head.commit.body.message > b.head.commit.body.message) {
      return 1;
    }

    if (a.head.hash < b.head.hash) {
      return -1;
    } else if (a.head.hash > b.head.hash) {
      return 1;
    }

    return 0;
  });

  let prev: Hash = leafHeads[0].head.hash;
  for (let i = 1; i < leafHeads.length; i++) {
    const commitIdA = prev;
    const commitIdB = leafHeads[i].head.hash;

    const treeA = await getTreeBody(repo, commitIdA);
    const treeB = await getTreeBody(repo, commitIdB);

    // Figure out base
    const mergeBaseResult = await mergeBase(repo, [commitIdA, commitIdB]);
    let baseTree: ExpandedTree | undefined = undefined;
    if (mergeBaseResult.bestAncestorCommitIds.length > 0) {
      const baseCommitId = mergeBaseResult.bestAncestorCommitIds[0];
      const baseCommit = await loadCommitObject(repo, baseCommitId);
      if (baseCommit === undefined) {
        throw new Error();
      }
      if (await isTreeFullyReachable(repo, baseCommit.body.tree)) {
        // TODO: Avoid reloading the same objects so many times.
        const tree = await loadTreeObject(repo, baseCommit.body.tree);
        if (tree === undefined) {
          throw new Error();
        }

        baseTree = treeToWorkingTree(tree.body);
      } else {
        // Try to keep going, if merge func can work without a base, let it try its thing...
      }
    }

    const newTree = await merge(treeA, treeB, baseTree);
    prev = await createCommit(
      repo,
      newTree,
      [commitIdA, commitIdB],
      `Reconcile forg clients ${leafHeads
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
    `reconcile: ${leafHeads.map((h) => h.clientUuid).join(', ')}`,
  );

  return prev;
}

function createCommitterInfo(forgClient: ForgClientInfo): Person {
  const now = new Date();
  return {
    name: forgClient.uuid,
    email: `${forgClient.uuid}@forg`, // TODO: Figure out what to use for commiter email
    date: {
      seconds: (new Date().getTime() / 1000) | 0,
      offset: now.getTimezoneOffset(),
    },
  };
}

async function getTreeBody(repo: IRepo, commitId: Hash): Promise<ExpandedTree> {
  const commit = await loadCommitObject(repo, commitId);
  if (commit === undefined) {
    throw new Error();
  }
  const tree = await loadTreeObject(repo, commit.body.tree);
  if (tree === undefined) {
    throw new Error();
  }
  const workingTree = treeToWorkingTree(tree.body);
  return workingTree;
}
