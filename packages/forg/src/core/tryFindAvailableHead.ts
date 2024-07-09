import { IRepo, Hash, loadCommitObject, walkTree, MissingObjectError, CommitObject } from "../git";

export interface CommitDetails {
  hash: string;
  commit: CommitObject;
}

export async function tryFindAvailableHead(repo: IRepo, ref: string): Promise<CommitDetails | undefined> {
  const commitId = await repo.getRef(ref);
  if (commitId !== undefined) {
    // Option 1: Use the actual ref and its git history
    const result = await tryFindAvailableCommitFromHead(repo, commitId);
    if (result !== undefined) {
      return result;
    }
  }

  // Option 2: Try the reflog
  const commitFromReflog = await tryFindAvailableCommitFromReflog(repo, ref);
  if (commitFromReflog !== undefined) {
    return commitFromReflog;
  };

  return undefined;
}

/**
 * Strategy: explore the Git commit history starting from the commit indicated by the given hash.
 * If any objects are missing in a given commit, try the parent commit instead.
 * Keep going until we find one commit for which we have the entire tree, otherwise return null.
 */
async function tryFindAvailableCommitFromHead(repo: IRepo, commitId: Hash): Promise<CommitDetails | undefined> {
  let nextCommitIdToTry: string | undefined = commitId;
  while (nextCommitIdToTry !== undefined) {
    const commitObject = await loadCommitObject(repo, nextCommitIdToTry);
    if (commitObject === undefined) {
      return undefined;
    }

    if (await isCommitViable(repo, commitObject)) {
      return { hash: nextCommitIdToTry, commit: commitObject };
    }

    nextCommitIdToTry = commitObject.body.parents.length > 0 ? commitObject.body.parents[0] : undefined;
  }

  return undefined;
}

/**
 * Strategy: use the reflog backwards, and find the most recent entry for which we have a complete commit.
 */
async function tryFindAvailableCommitFromReflog(repo: IRepo, ref: string): Promise<CommitDetails | undefined> {
  const reflog = await repo.getReflog(ref);
  for (let i = reflog.length - 1; i >= 0; i--) {
    const entry = reflog[i];
    const commit = await loadCommitObject(repo, entry.newCommit);
    if (commit !== undefined && await isCommitViable(repo, commit)) {
      return { hash: entry.newCommit, commit };
    }
  }

  return undefined;
}

async function isCommitViable(repo: IRepo, commitObject: CommitObject): Promise<boolean> {
  try {
    for await (const leaf of walkTree(repo, commitObject.body.tree)) {
      if (!await repo.hasObject(leaf.hash)) {
        return false;
      }
    }
  }
  catch (error) {
    if (error instanceof MissingObjectError) {
      return false;
    }

    throw error;
  }

  return true;
}
