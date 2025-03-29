import { IRepo, Hash, loadCommitObject, GitDbError, GitDbErrno } from '../../git';
import { HeadInfo } from '../model';

type CommitPredicate = (repo: IRepo, head: HeadInfo) => Promise<boolean>;

export async function findCommit(repo: IRepo, ref: string, predicate: CommitPredicate): Promise<HeadInfo | undefined> {
  const commitId = await repo.getRef(ref);
  if (commitId !== undefined) {
    // Option 1: Use the actual ref and its git history
    const result = await findCommitFromRef(repo, commitId, predicate);
    if (result !== undefined) {
      return result;
    }
  }

  // Option 2: Try the reflog
  const commitFromReflog = await findCommitFromReflog(repo, ref, predicate);
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
async function findCommitFromRef(repo: IRepo, commitId: Hash, predicate: CommitPredicate): Promise<HeadInfo | undefined> {
  let nextCommitIdToTry: string | undefined = commitId;
  while (nextCommitIdToTry !== undefined) {
    let head: HeadInfo;
    try {
      const commit = await loadCommitObject(repo, nextCommitIdToTry);
      head = { commitId: nextCommitIdToTry, commit };
    } catch (error) {
      if (error instanceof GitDbError && error.errno === GitDbErrno.MissingObject) {
        return undefined;
      }

      throw error;
    }

    if (await predicate(repo, head)) {
      return head;
    }

    // TODO: Is it really appropriate to always follow the left side of a merge?
    nextCommitIdToTry = head.commit.body.parents.length > 0 ? head.commit.body.parents[0] : undefined;
  }

  return undefined;
}

/**
 * Strategy: use the reflog backwards, and find the most recent entry for which we have a complete commit.
 */
async function findCommitFromReflog(repo: IRepo, ref: string, predicate: CommitPredicate): Promise<HeadInfo | undefined> {
  const reflog = await repo.getReflog(ref);
  for (let i = reflog.length - 1; i >= 0; i--) {
    const entry = reflog[i];
    let head: HeadInfo;
    try {
      const commit = await loadCommitObject(repo, entry.newCommit);
      head = { commitId: entry.newCommit, commit };
    } catch (error) {
      if (error instanceof GitDbError && error.errno === GitDbErrno.MissingObject) {
        continue;
      }

      throw error;
    }

    if (await predicate(repo, head)) {
      return head;
    }
  }

  return undefined;
}
