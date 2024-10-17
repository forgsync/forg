import {
  Hash,
  IReadOnlyRepo,
  IRepo,
} from '../git';
import { SyncOptions } from './model';
import { syncRef, SyncRefConsistency, SyncRefOptions } from './syncRef';

export async function forcePush(src: IReadOnlyRepo, dst: IRepo, ref: string, options?: SyncOptions): Promise<Hash> {
  //console.log(`Pushing ref '${ref}'`);
  const syncRefOptions: SyncRefOptions = {
    attemptRecoveryFromSrcReflog: false, // Local repo should always be consistent, so there's no need to leverage reflog
    dstRefConsistency: SyncRefConsistency.Pessimistic, // Destination repo may not be consistent (e.g. another party could have deleted objects that we care about)
    commitSyncOptions: options,
  };
  return await syncRef(src, dst, ref, syncRefOptions);
}
