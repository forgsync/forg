import { Hash, IRepo } from '../../git';
import { findCommit } from './findCommit';
import { tryParseForgRef } from './tryParseForgRef';
import { isTreeFullyReachable } from './isTreeFullyReachable';

export interface ResolvedForgRef {
  ref: string;
  clientUuid: string;
  branchName: string;
  commitId: string;
}

/**
 * Lists remote refs for the specified branch.
 */
export async function listForgRefs(repo: IRepo, branchName: string, assumeConsistentRepo: boolean): Promise<ResolvedForgRef[]> {
  const results: ResolvedForgRef[] = [];

  for (const ref of await repo.listRefs('refs/remotes')) {
    const refInfo = tryParseForgRef(ref);
    if (refInfo && refInfo.branchName === branchName) {
      const commitId = await resolveRef(repo, ref, assumeConsistentRepo);
      if (commitId !== undefined) {
        results.push({ ref, clientUuid: refInfo.client.uuid, branchName, commitId });
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
    const head = await findCommit(repo, ref, (repo, head) => isTreeFullyReachable(repo, head.commit.body.tree));
    if (head !== undefined) {
      return head.commitId;
    }
  }

  return undefined;
}
