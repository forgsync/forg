import { Hash, IRepo } from '../../git';
import { findCommit } from './findCommit';
import { tryParseForgRef } from './tryParseForgRef';
import { isTreeFullyReachable } from './isTreeFullyReachable';

export interface ForgRef {
  clientUuid: string;
  commitId: string;
}

/**
 * Lists all refs (remotes and heads) for the specified forg branch.
 */
export async function listForgRefs(repo: IRepo, branchName: string, assumeConsistentRepo: boolean): Promise<ForgRef[]> {
  const results: ForgRef[] = [];

  for (const ref of await repo.listRefs('refs/remotes')) {
    const refInfo = tryParseForgRef(ref);
    if (refInfo && refInfo.branchName === branchName) {
      const commitId = await resolveRef(repo, ref, assumeConsistentRepo);
      if (commitId !== undefined) {
        results.push({ clientUuid: refInfo.client.uuid, commitId });
      }
    }
  }

  return results;
}

async function resolveRef(repo: IRepo, ref: string, assumeConsistentRepo: boolean): Promise<Hash | undefined> {
  if (assumeConsistentRepo) {
    const hash = await repo.getRef(ref);
    if (!hash) {
      // Possible benign race condition, the ref might have just been deleted... 
      return undefined;
    }
    return hash;
  }
  else {
    const head = await findCommit(repo, ref, (repo, commit) => isTreeFullyReachable(repo, commit.body.tree));
    if (head !== undefined) {
      return head.hash;
    }
  }

  return undefined;
}
