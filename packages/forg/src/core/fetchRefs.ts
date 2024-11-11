import { IReadOnlyRepo, IRepo } from '../git';
import { ForgClientInfo } from './model';
import { tryParseForgRemoteRef } from './internal/tryParseForgRef';
import { forceFetchRef, FetchStrategy } from '../git';

/**
 * Fetches forg heads from the provided `remote` to the `local` repo.
 * This method will force-fetch all refs managed by other forg clients.
 * Optionally, if `branchName` is specified, only that branch (but still from every other client) will be fetched.
 */
export async function fetchRefs(local: IRepo, remote: IReadOnlyRepo, client: ForgClientInfo, strategy: FetchStrategy = FetchStrategy.DefaultForFetch, branchName?: string): Promise<void> {
  const remoteRefs = await remote.listRefs('refs/remotes');
  for (const ref of remoteRefs) {
    // Fetch all remote refs except for ours. Nobody else should touch our remote branch anyway in the remote repo (see The Rules of Forg)
    const refInfo = tryParseForgRemoteRef(ref);
    if (refInfo !== undefined &&
      refInfo.client.uuid !== client.uuid && // Only fetch remotes from other clients
      (branchName === undefined || refInfo.branchName === branchName)) {
      await forceFetchRef(local, remote, ref, strategy);
    }
  }

  // Fetch all head refs
  const headRefs = await remote.listRefs('refs/heads');
  for (const ref of headRefs) {
    await forceFetchRef(local, remote, ref, strategy);
  }
}
