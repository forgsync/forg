import { Hash, IReadOnlyRepo, IRepo } from '../db';
import { syncRef, SyncRefOptions, SyncStrategy } from './internal/syncRef';

// Subset of sync strategies that make sense for fetch:
export type FetchStrategy =
  | SyncStrategy.Fastest
  | SyncStrategy.FastAndDeepen
  | SyncStrategy.FullSyncTopCommit
  | SyncStrategy.FullSyncAll
  | SyncStrategy.OverwriteAll
  | SyncStrategy.DefaultForFetch
  | SyncStrategy.DefaultForFetchFasterButRisky
  ;
export const FetchStrategy = {
  Fastest: SyncStrategy.Fastest,
  FastAndDeepen: SyncStrategy.FastAndDeepen,
  FullSyncTopCommit: SyncStrategy.FullSyncTopCommit,
  FullSyncAll: SyncStrategy.FullSyncAll,
  OverwriteAll: SyncStrategy.OverwriteAll,
  DefaultForFetch: SyncStrategy.DefaultForFetch,
  DefaultForFetchFasterButRisky: SyncStrategy.DefaultForFetchFasterButRisky,
} as const satisfies Record<string, FetchStrategy>;

/**
 * Fetches the specified ref from the remote to the local repo.
 * The local ref will be overwritten to match the remote ref and local changes could be lost.
 */
export async function forceFetchRef(local: IRepo, remote: IReadOnlyRepo, ref: string, strategy: FetchStrategy = FetchStrategy.DefaultForFetch): Promise<Hash> {
  //console.log(`Fetching ref '${ref}'`);

  const syncRefOptions: SyncRefOptions = {
    attemptRecoveryFromSrcReflog: true, // Remote repo may not be consistent (e.g. another party could have deleted objects that we care about, or objects may still be uploading out of order), and using reflog may allow us to fully get at least a previous commit tree even if it is not precisely the latest
    reflogOperationName: 'fetch (force)',
    strategy,
  };
  return await syncRef(remote, local, ref, syncRefOptions);
}
