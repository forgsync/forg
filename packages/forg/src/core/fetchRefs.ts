import { IReadOnlyRepo, IRepo } from '../git';
import { ForgClientInfo } from './model';
import { tryParseForgRemoteRef } from './internal/tryParseForgRef';
import { forceFetchRef, FetchStrategy } from '../git';

/**
 * Fetches refs from the provided `remote` to the `local` repo.
 * This method will force-fetch all remotes managed by other forg clients, as well as all heads.
 * Optionally, if `branchName` is specified, only that branch (but still from every other client) will be fetched.
 */
export async function fetchRefs(local: IRepo, remote: IReadOnlyRepo, client: ForgClientInfo, strategy: FetchStrategy = FetchStrategy.DefaultForFetch, branchName?: string): Promise<void> {
  // TODO: Do not explode if attempting to sync one ref failed...

  const remoteRefs = await remote.listRefs('refs/remotes');
  // Fetch all remote refs except for ours. Nobody else should touch our remote branch anyway in the remote repo (see The Rules of Forg)
  for (const ref of remoteRefs) {
    const refInfo = tryParseForgRemoteRef(ref);
    if (refInfo !== undefined &&
      refInfo.client.uuid !== client.uuid && // Only fetch remotes from other clients
      (branchName === undefined || refInfo.branchName === branchName)) {
      await forceFetchRef(local, remote, ref, strategy);
    }
  }

  // Fetch all head refs
  if (branchName !== undefined) {
    const ref = `refs/heads/${branchName}`;
    // TODO: Skip resolving the ref twice (here and inside forceFetchRef). This is both inefficient and incorrect in some cases.
    if (await remote.getRef(ref) !== undefined) {
      await forceFetchRef(local, remote, ref, strategy);
    }
  }
  else {
    const headRefs = await remote.listRefs('refs/heads');
    for (const ref of headRefs) {
      await forceFetchRef(local, remote, ref, strategy);
    }
  }
}
