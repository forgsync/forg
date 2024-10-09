import { IRepo } from '../../git';
import { HeadInfo, tryFindAvailableHead } from './tryFindAvailableHead';
import { tryParseForgRemoteRef } from './tryParseForgRef';

export interface ForgClientHead {
  clientUuid: string;
  head: HeadInfo;
}

// TODO: Rename this method, it is misleading since it deals with remotes, but is called heads, and those are mutually exclusive when it comes to refs nomenclature.
export async function listForgHeads(repo: IRepo, branchName: string): Promise<ForgClientHead[]> {
  const results: ForgClientHead[] = [];

  for (const ref of await repo.listRefs('refs/remotes')) {
    const refInfo = tryParseForgRemoteRef(ref);
    if (refInfo && refInfo.branchName === branchName) {
      const head = await tryFindAvailableHead(repo, ref);
      if (head !== undefined) {
        results.push({ clientUuid: refInfo.client.uuid, head });
      }
    }
  }

  return results;
}
