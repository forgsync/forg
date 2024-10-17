import {
  Hash,
  IReadOnlyRepo,
  IRepo,
} from '../git';
import { ForgClientInfo, SyncOptions } from "./model";
import { tryParseForgRemoteRef } from './internal/tryParseForgRef';
import { syncRef, SyncRefConsistency, SyncRefOptions } from './syncRef';

/**
 * Fetches forg heads from the provided `remote` to the `local` repo.
 * The predicate selects which heads should be fetched. In most cases, a fetch would apply to all branches except for those of the current forg client uuid.
 */
export async function fetchRefs(origin: IReadOnlyRepo, local: IRepo, client: ForgClientInfo, options?: SyncOptions): Promise<void> {
  const remoteRefs = await origin.listRefs('refs/remotes');
  for (const ref of remoteRefs) {
    // Fetch all remote refs except for ours. Nobody else should touch our remote branch anyway in the remote repo (see The Rules of Forg)
    const refInfo = tryParseForgRemoteRef(ref);
    if (refInfo !== undefined && refInfo.client.uuid !== client.uuid) {
      await fetchRef(origin, local, ref, options);
    }
  }

  // Fetch all head refs
  const headRefs = await origin.listRefs('refs/heads');
  for (const ref of headRefs) {
    await fetchRef(origin, local, ref, options);
  }
}

/**
 * @returns the commit hash that was successfully fetched, if any. This method will first try to fetch the commit that the ref actually points to if it is a valid and complete commit,
 * but if that fails, we fall back to using the remote reflog instead.
 */
export async function fetchRef(src: IReadOnlyRepo, dst: IRepo, ref: string, options?: SyncOptions): Promise<Hash> {
  //console.log(`Fetching ref '${ref}'`);
  const syncRefOptions: SyncRefOptions = {
    attemptRecoveryFromSrcReflog: true, // Destination repo may not be consistent (e.g. another party could have deleted objects that we care about), and using reflog may allow us to get at least _some_ updates even if not the latest
    dstRefConsistency: SyncRefConsistency.AssumeConnectivity, // Local repo should always be consistent, so we can trust refs to point to valid and complete commits
    // TODO: Add support for deepening the history in case a previous sync completed only partially. Perhaps that should be the default (?)
    commitSyncOptions: options,
  };
  return await syncRef(src, dst, ref, syncRefOptions);
}
