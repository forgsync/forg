import {
  Hash,
  IReadOnlyRepo,
  IRepo,
} from '../git';
import { SyncConsistency } from './model';
import { syncRef, SyncRefOptions } from './syncRef';

export enum PushMode {
  /**
   * Assumes a fully connected graph for all objects that exist in the remote. This is the recommended default in most cases.
   */
  Fast,

  /**
   * Ensures that the top commit's tree and the tree's dependencies actually exist in the destination,
   * but assumes a connected graph for other commits. This means that if files were randomly deleted in the remote,
   * we guarantee that at least the top commit contents will be salvageable after this, but not necessarily its history.
   */
  FullSyncTopCommit,

  /**
   * Ensures that every referenced object actually exists in the destination.
   * This can be very slow, and generally is only useful to restore a bad remote after files were catastrophically deleted.
   */
  FullSyncAll,

  /**
   * Overwrites every object in the destination.
   * This is equivalent to a fresh clone, and is rarely if ever useful.
   */
  OverwriteAll,

  /**
   * Recommended default, equals to `Fast`.
   */
  Default = Fast,
}

export async function forcePushRef(src: IReadOnlyRepo, dst: IRepo, ref: string, mode: PushMode): Promise<Hash> {
  //console.log(`Pushing ref '${ref}'`);

  let topCommitConsistency: SyncConsistency;
  let otherCommitsConsistency: SyncConsistency;
  switch (mode) {
    default:
    case PushMode.Fast:
      topCommitConsistency = otherCommitsConsistency = SyncConsistency.AssumeTotalConnectivity;
      break;
    case PushMode.FullSyncTopCommit:
      topCommitConsistency = SyncConsistency.AssumeObjectIntegrity;
      otherCommitsConsistency = SyncConsistency.AssumeTotalConnectivity;
      break;
    case PushMode.FullSyncAll:
      topCommitConsistency = otherCommitsConsistency = SyncConsistency.AssumeObjectIntegrity;
      break;
    case PushMode.OverwriteAll:
      topCommitConsistency = otherCommitsConsistency = SyncConsistency.Pessimistic;
      break;
  }

  const syncRefOptions: SyncRefOptions = {
    attemptRecoveryFromSrcReflog: false, // Local repo should always be consistent, so there's no need to leverage reflog
    reflogOperationName: 'push (force)',
    commitSyncOptions: {
      topCommitConsistency,
      otherCommitsConsistency,
      allowShallow: true, // Because the local repo could be shallow as a result of a previous shallow fetch
    },
  };
  return await syncRef(src, dst, ref, syncRefOptions);
}
