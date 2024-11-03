import {
  Hash,
  IReadOnlyRepo,
  IRepo,
} from '../db';
import { syncRef, SyncRefOptions, SyncStrategy } from './syncRef';

// Subset of sync strategies that make sense for push:
export type PushStrategy =
  | SyncStrategy.Fastest
  | SyncStrategy.FastAndDeepen
  | SyncStrategy.FullSyncTopCommit
  | SyncStrategy.FullSyncAll
  | SyncStrategy.OverwriteAll
  | SyncStrategy.DefaultForPush
  | SyncStrategy.DefaultForPushFasterButRisky
  | SyncStrategy.DefaultForPushSlowerButSafe
  ;
export const PushStrategy = {
  Fastest: SyncStrategy.Fastest,
  FastAndDeepen: SyncStrategy.FastAndDeepen,
  FullSyncTopCommit: SyncStrategy.FullSyncTopCommit,
  FullSyncAll: SyncStrategy.FullSyncAll,
  OverwriteAll: SyncStrategy.OverwriteAll,
  DefaultForPush: SyncStrategy.DefaultForPush,
  DefaultForPushFasterButRisky: SyncStrategy.DefaultForPushFasterButRisky,
  DefaultForPushSlowerButSafe: SyncStrategy.DefaultForPushSlowerButSafe,
} as const satisfies Record<string, PushStrategy>;

/**
 * @returns the commit hash that was successfully synced.
 * If the ref doesn't point to a valid and complete (*) commit in the src repo, an error is thrown.
 * 
 * (*) a commit is determined to be valid and complete when it can be fully synced from the source to the destination according to the specified sync strategy.
 */
export async function forcePushRef(local: IReadOnlyRepo, remote: IRepo, ref: string, strategy: PushStrategy = PushStrategy.DefaultForPush): Promise<Hash> {
  //console.log(`Pushing ref '${ref}'`);

  const syncRefOptions: SyncRefOptions = {
    attemptRecoveryFromSrcReflog: false, // Local repo should always be consistent, so there's no need to leverage reflog
    reflogOperationName: 'push (force)',
    strategy,
  };
  return await syncRef(local, remote, ref, syncRefOptions);
}
