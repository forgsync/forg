import {
  Hash,
  IReadOnlyRepo,
  IRepo,
} from '../git';
import { ForgClientInfo, SyncConsistency } from "./model";
import { tryParseForgRemoteRef } from './internal/tryParseForgRef';
import { syncRef, SyncRefOptions } from './syncRef';

/**
 * Fetches forg heads from the provided `remote` to the `local` repo.
 * The predicate selects which heads should be fetched. In most cases, a fetch would apply to all branches except for those of the current forg client uuid.
 */
export async function fetchRefs(origin: IReadOnlyRepo, local: IRepo, client: ForgClientInfo): Promise<void> {
  const remoteRefs = await origin.listRefs('refs/remotes');
  for (const ref of remoteRefs) {
    // Fetch all remote refs except for ours. Nobody else should touch our remote branch anyway in the remote repo (see The Rules of Forg)
    const refInfo = tryParseForgRemoteRef(ref);
    if (refInfo !== undefined && refInfo.client.uuid !== client.uuid) {
      await fetchRef(origin, local, ref);
    }
  }

  // Fetch all head refs
  const headRefs = await origin.listRefs('refs/heads');
  for (const ref of headRefs) {
    await fetchRef(origin, local, ref);
  }
}

/**
 * @returns the commit hash that was successfully fetched, if any. This method will first try to fetch the commit that the ref actually points to if it is a valid and complete commit,
 * but if that fails, we fall back to using the remote reflog instead.
 */
export async function fetchRef(src: IReadOnlyRepo, dst: IRepo, ref: string): Promise<Hash> {
  //console.log(`Fetching ref '${ref}'`);
  const syncRefOptions: SyncRefOptions = {
    attemptRecoveryFromSrcReflog: true, // Source repo may not be consistent (e.g. another party could have deleted objects that we care about), and using reflog may allow us to get at least _some_ updates even if not the latest
    reflogOperationName: 'fetch',
    commitSyncOptions: {
      // We trust the destination repo to always be connected because we would never write an object until all of its dependencies have been written
      topCommitConsistency: SyncConsistency.AssumeConnectivity,
      otherCommitsConsistency: SyncConsistency.AssumeConnectivity,

      // If some objects are missing in the remote, still attempt to sync as much as we can
      allowShallow: true,

      // Eventual consistency when fetching a ref that we had previously fetched successfully but only partially
      attemptDeepen: true,
    },
  };
  return await syncRef(src, dst, ref, syncRefOptions);
}
