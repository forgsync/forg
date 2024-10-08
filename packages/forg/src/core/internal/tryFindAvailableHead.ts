import { IRepo, Hash, loadCommitObject, CommitObject, MissingObjectError } from '../../git';
import { isTreeFullyReachable } from './isTreeFullyReachable';

export interface HeadInfo {
  hash: string;
  commit: CommitObject;
}

export async function tryFindAvailableHead(
  repo: IRepo,
  ref: string,
): Promise<HeadInfo | undefined> {
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
  }

  return undefined;
}

/**
 * Strategy: explore the Git commit history starting from the commit indicated by the given hash.
 * If any objects are missing in a given commit, try the parent commit instead.
 * Keep going until we find one commit for which we have the entire tree, otherwise return null.
 */
async function tryFindAvailableCommitFromHead(
  repo: IRepo,
  commitId: Hash,
): Promise<HeadInfo | undefined> {
  let nextCommitIdToTry: string | undefined = commitId;
  while (nextCommitIdToTry !== undefined) {
    let commit: CommitObject;
    try {
      commit = await loadCommitObject(repo, nextCommitIdToTry);
    } catch (error) {
      if (error instanceof MissingObjectError) {
        return undefined;
      }

      throw error;
    }

    if (await isTreeFullyReachable(repo, commit.body.tree)) {
      return { hash: nextCommitIdToTry, commit: commit };
    }

    nextCommitIdToTry = commit.body.parents.length > 0 ? commit.body.parents[0] : undefined;
  }

  return undefined;
}

/**
 * Strategy: use the reflog backwards, and find the most recent entry for which we have a complete commit.
 */
async function tryFindAvailableCommitFromReflog(
  repo: IRepo,
  ref: string,
): Promise<HeadInfo | undefined> {
  const reflog = await repo.getReflog(ref);
  for (let i = reflog.length - 1; i >= 0; i--) {
    const entry = reflog[i];
    let commit: CommitObject;
    try {
      commit = await loadCommitObject(repo, entry.newCommit);
    } catch (error) {
      if (error instanceof MissingObjectError) {
        continue;
      }

      throw error;
    }

    if (await isTreeFullyReachable(repo, commit.body.tree)) {
      return { hash: entry.newCommit, commit: commit };
    }
  }

  return undefined;
}
