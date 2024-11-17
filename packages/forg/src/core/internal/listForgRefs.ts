import { Hash, IRepo } from '../../git';
import { tryFindAvailableHead } from './tryFindAvailableHead';
import { tryParseForgRemoteRef } from './tryParseForgRef';

export interface ForgRef {
  clientUuid: string | undefined;
  commitId: string;
}

/**
 * Lists all refs (remotes and heads) for the specified forg branch.
 */
export async function listForgRefs(repo: IRepo, branchName: string, assumeConsistentRepo: boolean): Promise<ForgRef[]> {
  const results: ForgRef[] = [];

  for (const ref of await repo.listRefs('refs/remotes')) {
    const refInfo = tryParseForgRemoteRef(ref);
    if (refInfo && refInfo.branchName === branchName) {
      const commitId = await resolveRef(repo, ref, assumeConsistentRepo);
      if (commitId) {
        results.push({ clientUuid: refInfo.client.uuid, commitId });
      }
    }
  }

  {
    const headRef = `refs/heads/${branchName}`;
    const commitId = await resolveRef(repo, headRef, assumeConsistentRepo);
    if (commitId) {
      results.push({ clientUuid: undefined, commitId });
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
    const head = await tryFindAvailableHead(repo, ref);
    if (head !== undefined) {
      return head.hash;
    }
  }

  return undefined;
}
