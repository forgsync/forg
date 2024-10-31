import {
  Hash,
  IReadOnlyRepo,
  IRepo,
} from '../db';
import { SyncConsistency } from './model';
import { syncRef, SyncRefOptions } from './syncRef';

export enum PushMode {
  /**
   * Assumes a fully connected graph for all objects that exist in the remote.
   * A potential issue with this mode is that another client may have uploaded objects out of order and could potentially die before uploading the remaining objects,
   * leading to an incomplete remote that would not self-heal.
   * For example:
   * 1. Say another forg client created an empty folder with a single file named `abc` with some contents;
   * 2. Said client started force-pushing a new commit containing that new folder and the file. But the upload happened out of order, such that the tree representing the folder was uploaded, but the blob representing the file was not.
   * 3. Said client dies, never to be seen again. The remote will never get the blob object with the contents of file `abc`.
   * 4. The current client is doing a force-push of a completely unrelated commit, but which happens to also contains a new folder, with a single file also named `abc` and with the same contents from the other (now deceased) client.
   * 5. Because of `Fast` mode, the current client would notice that the remote already has the tree object corresponding to the folder that contains the file (see step 2).
   *    HOWEVER, because we assumed graph connectivity, we assume that the blob referenced from the tree must  already exist in the remote, so we will not sync it.
   *    The outcome is that the blob for file `abc` will never be uploaded to the remote (violation of eventual consistency).
   * 
   * Alternatively to this:
   *   - `FullSyncTopCommit` still does not guarantee eventual consistency in a broad sense, but at least ensures that the *top* commit is complete in the remote,
   *     though potentially at great impact to sync speed: O(n) with number of objects in the *top* commit (trees, blobs), regardless of whether they changed or not.
   *   - `FullSyncAll` completely addresses this concern, but at great impact to sync speed: O(n) with number of objects in the entire commit history (commits, trees, blobs), regardless of whether they changed or not.
   * 
   * It can be a good idea to use a combination approach. For example, use `FullSyncTopCommit` or `FullSyncAll` at least once per day, but `Fast` all the other times.
   * This would ensure the remote is made whole again in at most 1 day, even after the unlikely event of missing objects described above.
   */
  Fast,

  /**
   * Ensures that the top commit's tree and the tree's dependencies actually exist in the remote,
   * but assumes a connected graph for other commits. This means that if files were randomly deleted in the remote or uploaded out of order and/or failed to upload,
   * we guarantee that the top commit contents will be complete after this (but not necessarily its history).
   * This is the recommended default in most cases (`Fast` can also be used as long as there is a way for a user to optionally request a more thorough push to recover from common problems. See more in the comments for `Fast`).
   */
  FullSyncTopCommit,

  /**
   * Ensures that every referenced object actually exists in the remote.
   * This can be very slow, but it is useful to restore a bad remote after files were catastrophically deleted and/or failed to be uploaded by some client.
   */
  FullSyncAll,

  /**
   * Overwrites every object in the remote.
   * This is only useful to recover if objects are tampered in the remote (i.e. the contents of some objects would have to be invalid). Otherwise, prefer `FullSyncAll` which does the same, but assumes object integrity and is therefore faster.
   */
  OverwriteAll,

  /**
   * Recommended default, equals to `FullSyncTopCommit`.
   */
  Default = FullSyncTopCommit,
}

export async function forcePushRef(local: IReadOnlyRepo, remote: IRepo, ref: string, mode: PushMode): Promise<Hash> {
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
  return await syncRef(local, remote, ref, syncRefOptions);
}
