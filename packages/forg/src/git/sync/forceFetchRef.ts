import {
  Hash,
  IReadOnlyRepo,
  IRepo,
} from '../db';
import { syncRef, SyncRefOptions, SyncStrategy } from './syncRef';

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
 * @returns the commit hash that was successfully synced.
 * This method will attempt to sync commits in the following order:
 * 1. If the ref points to a valid and complete (*) commit in the src repo, then that commit;
 * 2. If not, then it iterates backwards over the reflog in the src repo, and uses the first valid and complete (*) commit.
 * 
 * (*) a commit is determined to be valid and complete when it can be fully synced from the source to the destination according to the specified sync strategy.
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
