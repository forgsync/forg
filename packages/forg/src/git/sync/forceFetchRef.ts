import {
  Hash,
  IReadOnlyRepo,
  IRepo,
} from '../db';
import { syncRef, SyncRefOptions, SyncStrategy } from './syncRef';

export type FetchStrategy = SyncStrategy.Fastest | SyncStrategy.FastAndDeepen | SyncStrategy.FullSyncTopCommit | SyncStrategy.FullSyncAll | SyncStrategy.OverwriteAll;
export const FetchStrategy: Record<string, FetchStrategy> = {
  Fastest: SyncStrategy.Fastest,
  FastAndDeepen: SyncStrategy.FastAndDeepen,
  FullSyncTopCommit: SyncStrategy.FullSyncTopCommit,
  FullSyncAll: SyncStrategy.FullSyncAll,
  OverwriteAll: SyncStrategy.OverwriteAll,
};
/**
 * @returns the commit hash that was successfully fetched, if any. This method will first try to fetch the commit that the ref actually points to if it is a valid and complete commit,
 * but if that fails, falls back to using the remote reflog instead.
 */
export async function forceFetchRef(remote: IReadOnlyRepo, local: IRepo, ref: string, strategy: FetchStrategy): Promise<Hash> {
  //console.log(`Fetching ref '${ref}'`);

  const syncRefOptions: SyncRefOptions = {
    attemptRecoveryFromSrcReflog: true, // Remote repo may not be consistent (e.g. another party could have deleted objects that we care about, or objects may still be uploading out of order), and using reflog may allow us to fully get at least a previous commit tree even if it is not precisely the latest
    reflogOperationName: 'fetch (force)',
    strategy,
  };
  return await syncRef(remote, local, ref, syncRefOptions);
}
