import { IRepo } from '../../git';
import { HeadInfo, tryFindAvailableHead } from './tryFindAvailableHead';

export interface ForgClientHead {
  clientUuid: string;
  head: HeadInfo;
}

const forgRefRegex = /^refs\/remotes\/([^\/]+)\/([^\/]+)$/;
export async function listForgHeads(repo: IRepo, branchName: string): Promise<ForgClientHead[]> {
  const results: ForgClientHead[] = [];

  for (const ref of await repo.listRefs('refs/remotes')) {
    const match = ref.match(forgRefRegex);
    if (match && match[2] === branchName) {
      const clientUuid = match[1];

      const head = await tryFindAvailableHead(repo, ref);
      if (head !== undefined) {
        results.push({ clientUuid, head });
      }
    }
  }

  return results;
}
