import {
  Hash,
  IReadOnlyRepo,
  IRepo,
} from '../db';
import { syncRef, SyncRefOptions, SyncStrategy } from './syncRef';

export type PushStrategy = SyncStrategy.Fast | SyncStrategy.FullSyncTopCommit | SyncStrategy.FullSyncAll | SyncStrategy.OverwriteAll;
export const PushStrategy: Record<string, PushStrategy> = {
  Fast: SyncStrategy.Fast,
  FullSyncTopCommit: SyncStrategy.FullSyncTopCommit,
  FullSyncAll: SyncStrategy.FullSyncAll,
  OverwriteAll: SyncStrategy.OverwriteAll,
};

export async function forcePushRef(local: IReadOnlyRepo, remote: IRepo, ref: string, strategy: PushStrategy): Promise<Hash> {
  //console.log(`Pushing ref '${ref}'`);

  const syncRefOptions: SyncRefOptions = {
    attemptRecoveryFromSrcReflog: false, // Local repo should always be consistent, so there's no need to leverage reflog
    reflogOperationName: 'push (force)',
    strategy,
  };
  return await syncRef(local, remote, ref, syncRefOptions);
}
