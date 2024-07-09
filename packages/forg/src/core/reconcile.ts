import { IRepo } from "../git";
import { ForgClientInfo } from "./model";
import { CommitDetails, tryFindAvailableHead } from "./tryFindAvailableHead";

export async function reconcile(repo: IRepo, branchName: string, forgClient: ForgClientInfo): Promise<void> {
  const clients = await listForgHeads(repo, branchName);
  // TODO: CONTINUE HERE
}

export interface ForgClientState {
  clientUuid: string;
  commit: CommitDetails;
}

const forgRefRegex = /^\/refs\/remotes\/([^\/]+)\/([^\/]+)$/;
export async function listForgHeads(repo: IRepo, branchName: string): Promise<ForgClientState[]> {
  const results: ForgClientState[] = [];

  for (const ref of await repo.listRefs('refs/remotes')) {
    const match = ref.match(forgRefRegex);
    if (match && match[2] === branchName) {
      const clientUuid = match[1];

      const commit = await tryFindAvailableHead(repo, ref);
      if (commit !== undefined) {
        results.push({ clientUuid, commit });
      }
    }
  }

  return results;
}
