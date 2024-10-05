import { IRepo } from '../../git';
import { HeadInfo, tryFindAvailableHead } from './tryFindAvailableHead';
import tryParseForgRef from './tryParseForgRef';

export interface ForgClientHead {
  clientUuid: string;
  head: HeadInfo;
}

export async function listForgHeads(repo: IRepo, branchName: string): Promise<ForgClientHead[]> {
  const results: ForgClientHead[] = [];

  for (const ref of await repo.listRefs('refs/remotes')) {
    const refInfo = tryParseForgRef(ref);
    if (refInfo && refInfo.branchName === branchName) {
      const head = await tryFindAvailableHead(repo, ref);
      if (head !== undefined) {
        results.push({ clientUuid: refInfo.clientUuid, head });
      }
    }
  }

  return results;
}
