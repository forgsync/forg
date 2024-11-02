import {
  IReadOnlyRepo,
  IRepo,
} from '../git';
import { ForgClientInfo } from "./model";
import { tryParseForgRemoteRef } from './internal/tryParseForgRef';
import { forceFetchRef, FetchStrategy } from '../git';

/**
 * Fetches forg heads from the provided `remote` to the `local` repo.
 * The predicate selects which heads should be fetched. In most cases, a fetch would apply to all branches except for those of the current forg client uuid.
 */
export async function fetchRefs(origin: IReadOnlyRepo, local: IRepo, client: ForgClientInfo, strategy: FetchStrategy): Promise<void> {
  const remoteRefs = await origin.listRefs('refs/remotes');
  for (const ref of remoteRefs) {
    // Fetch all remote refs except for ours. Nobody else should touch our remote branch anyway in the remote repo (see The Rules of Forg)
    const refInfo = tryParseForgRemoteRef(ref);
    if (refInfo !== undefined && refInfo.client.uuid !== client.uuid) {
      await forceFetchRef(origin, local, ref, strategy);
    }
  }

  // Fetch all head refs
  const headRefs = await origin.listRefs('refs/heads');
  for (const ref of headRefs) {
    await forceFetchRef(origin, local, ref, strategy);
  }
}
