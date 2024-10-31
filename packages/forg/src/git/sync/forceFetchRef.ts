import {
  Hash,
  IReadOnlyRepo,
  IRepo,
} from '../db';
import { SyncConsistency } from "./model";
import { syncRef, SyncRefOptions } from './syncRef';

export enum FetchMode {
  /**
   * Assumes that if a commit exists locally, it and its history are complete (and therefore don't need to be re-sync'ed).
   * This is not recommended as it does not achieve eventual consistency when shallow histories are involved.
   * For example, one fetch attempt may succeed partially with a shallow commit history.
   * When using `Fast` mode, a subsequent fetch attempt will not attempt to deepen the shallow history,
   * even if the complete history now exists in the remote.
   */
  Fast,

  /**
   * Similar to `Fast`, but will always traverse the local commits to ensure all parents also exists locally.
   * This is important to achieve eventual consistency in case the local repo had a shallow history that we can now deepen
   * (e.g. perhaps because during a previous fetch the remote was missing some objects).
   * This is the recommended default.
   */
  FastEventualConsistent,

  /**
   * Overwrites every object in the local repo.
   * This is only useful to recover if objects are tampered in the local repo (i.e. the contents of some objects would have to be invalid).
   */
  OverwriteAll,

  /**
   * Recommended default, equals to `FastEventualConsistent`.
   */
  Default = FastEventualConsistent,
}

/**
 * @returns the commit hash that was successfully fetched, if any. This method will first try to fetch the commit that the ref actually points to if it is a valid and complete commit,
 * but if that fails, falls back to using the remote reflog instead.
 */
export async function forceFetchRef(remote: IReadOnlyRepo, local: IRepo, ref: string, mode: FetchMode): Promise<Hash> {
  //console.log(`Fetching ref '${ref}'`);

  let consistency: SyncConsistency;
  switch (mode) {
    default:
    case FetchMode.Fast:
      consistency = SyncConsistency.AssumeTotalConnectivity;
      break;
    case FetchMode.FastEventualConsistent:
      consistency = SyncConsistency.AssumeCommitTreeConnectivity;
      break;
    case FetchMode.OverwriteAll:
      consistency = SyncConsistency.AssumeObjectIntegrity;
      break;
  }

  const syncRefOptions: SyncRefOptions = {
    attemptRecoveryFromSrcReflog: true, // Remote repo may not be consistent (e.g. another party could have deleted objects that we care about, or objects may still be uploading out of order), and using reflog may allow us to fully get at least a previous commit tree even if it is not precisely the latest
    reflogOperationName: 'fetch (force)',
    commitSyncOptions: {
      topCommitConsistency: consistency,
      otherCommitsConsistency: consistency,

      // If some objects are missing in the remote, still attempt to sync as much as we can
      // TODO: Should this be an option? It may be non-obvious to the caller that a shallow history could ensue (though arguably they should know better, since this is integral to the functioning of Forg)
      allowShallow: true,
    },
  };
  return await syncRef(remote, local, ref, syncRefOptions);
}
