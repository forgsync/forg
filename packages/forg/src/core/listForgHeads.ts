import { IRepo } from "../git";
import { ForgClientInfo } from "./model";
import { CommitDetails, tryFindAvailableHead } from "./tryFindAvailableHead";

export interface ForgClientState {
  clientUuid: string;
  commit: CommitDetails;
}

const forgRefRegex = /^refs\/remotes\/([^\/]+)\/([^\/]+)$/;
export async function listForgHeads(repo: IRepo, forgClient: ForgClientInfo, branchName: string): Promise<ForgClientState[]> {
  const results: ForgClientState[] = [];

  for (const ref of await repo.listRefs('refs/remotes')) {
    const match = ref.match(forgRefRegex);
    if (match && match[2] === branchName) {
      const clientUuid = match[1];
      if (forgClient.uuid === clientUuid) {
        // Don't look at our own head, we already know where that is...
        continue;
      }

      const commit = await tryFindAvailableHead(repo, ref);
      if (commit !== undefined) {
        results.push({ clientUuid, commit });
      }
    }
  }

  return results;
}
