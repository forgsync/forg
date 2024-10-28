import {
  Hash,
  IReadOnlyRepo,
  IRepo,
} from '../db';
import { SyncConsistency } from "./model";
import { syncRef, SyncRefOptions } from './syncRef';

export enum FetchMode {
  Fast,
  FastEventualConsistent,
  Pessimistic,

  /**
   * Recommended default, equals to `FastEventualConsistent`.
   */
  Default = FastEventualConsistent,
}

/**
 * @returns the commit hash that was successfully fetched, if any. This method will first try to fetch the commit that the ref actually points to if it is a valid and complete commit,
 * but if that fails, we fall back to using the remote reflog instead.
 */
export async function fetchRef(src: IReadOnlyRepo, dst: IRepo, ref: string, mode: FetchMode): Promise<Hash> {
  //console.log(`Fetching ref '${ref}'`);

  let topCommitConsistency: SyncConsistency;
  let otherCommitsConsistency: SyncConsistency;
  switch (mode) {
    default:
    case FetchMode.Fast:
      topCommitConsistency = otherCommitsConsistency = SyncConsistency.AssumeTotalConnectivity;
      break;
    case FetchMode.FastEventualConsistent:
      topCommitConsistency = otherCommitsConsistency = SyncConsistency.AssumeCommitConnectivity;
      break;
    case FetchMode.Pessimistic:
      topCommitConsistency = otherCommitsConsistency = SyncConsistency.AssumeObjectIntegrity;
      break;
  }

  const syncRefOptions: SyncRefOptions = {
    attemptRecoveryFromSrcReflog: true, // Source repo may not be consistent (e.g. another party could have deleted objects that we care about), and using reflog may allow us to get at least _some_ updates even if not the latest
    reflogOperationName: 'fetch',
    commitSyncOptions: {
      topCommitConsistency,
      otherCommitsConsistency,

      // If some objects are missing in the remote, still attempt to sync as much as we can
      allowShallow: true,
    },
  };
  return await syncRef(src, dst, ref, syncRefOptions);
}
