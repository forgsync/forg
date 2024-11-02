import {
  Hash,
  IReadOnlyRepo,
  IRepo,
  loadCommitObject,
  MissingObjectError,
  updateRef,
} from '../db';
import { syncCommit, SyncConsistency, SyncOptions } from './syncCommit';

export enum SyncStrategy {
  /**
   * Assumes a fully connected graph for all objects that exist in the remote.
   * This has potential issues both during `fetch` and `push`, and is NOT recommended as the default strategy at all times.
   * 
   * ### Issues during `push`:
   * 
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
   * 
   * 
   * ### Issues during `fetch`:
   * 
   * This is not recommended as it does not achieve eventual consistency when shallow histories are involved.
   * For example, one fetch attempt may succeed partially with a shallow commit history.
   * When using `Fast` mode, a subsequent fetch attempt will not attempt to deepen the shallow history,
   * even if the complete history now exists in the remote.
   */
  Fast,

  /**
   * Similar to `Fast`, but will always traverse the local commits to ensure all parents also exists locally.
   * This is important during `fetch` to achieve eventual consistency in case the local repo had a shallow history that we can now deepen
   * (e.g. perhaps because during a previous fetch the remote was missing some objects).
   * This is the recommended default for `fetch` in most cases.
   */
  FastAndDeepen,

  /**
   * Ensures that the top commit's tree and the tree's dependencies actually exist in the remote,
   * but assumes a connected graph for other commits. This means that if files were randomly deleted in the remote or uploaded out of order and/or failed to upload,
   * we guarantee that the top commit contents will be complete after this (but not necessarily its history).
   * This is the recommended default for `push` in most cases (`Fast` can also be used as long as there is a way for a user to optionally request a more thorough push to recover from common problems. See more in the comments for `Fast`).
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
}

export interface SyncRefOptions {
  /**
   * Whether fallback to reflog is allowed in case the commit pointed to by the provided ref is incomplete in the src repo
   * (e.g. if objects are missing, perhaps because another client hasn't completed uploading yet).
   */
  attemptRecoveryFromSrcReflog: boolean;

  /**
   * The prefix that will accompany reflog entries generated at the destination repo by this operation.
   * The reflog message will be formatted as `${reflogOperationName}: ${firstLine(commit.body.message)}`.
   */
  reflogOperationName: 'fetch (force)' | 'push (force)';

  /**
   * Options for syncing individual commits and associated objects.
   */
  strategy: SyncStrategy;
}

/**
 * @returns the commit hash that was successfully fetched, if any. This method will first try to fetch the commit that the ref actually points to if it is a valid and complete commit,
 * but if that fails, we fall back to using the remote reflog instead (when `options.attemptRecoveryFromSrcReflog is set)`.
 */
export async function syncRef(src: IReadOnlyRepo, dst: IRepo, ref: string, options: SyncRefOptions): Promise<Hash> {
  //console.log(`Syncing ref '${ref}'`);
  const srcRefCommitHash = await src.getRef(ref);
  if (srcRefCommitHash === undefined) {
    throw new Error(`Ref '${ref}' does not exist in the src repo`);
  }

  const { topCommitConsistency, otherCommitsConsistency } = getConsistency(options.strategy);
  const syncOptions: SyncOptions = {
    allowShallow: true,
    topCommitConsistency,
    otherCommitsConsistency,
  };

  let syncedCommitHash: Hash | undefined = undefined;
  const oldDstRefCommitHash = await dst.getRef(ref);
  if (topCommitConsistency === SyncConsistency.AssumeTotalConnectivity && oldDstRefCommitHash === srcRefCommitHash) {
    // No-op: Destination is already here and we assume it to be fully connected
    return srcRefCommitHash;
  }

  if (await trySyncCommit(src, dst, srcRefCommitHash, syncOptions)) {
    syncedCommitHash = srcRefCommitHash;
  }
  else {
    // If we couldn't fetch the commit in its entirety (e.g. perhaps we are missing one blob from one of the parent commits, but also possibly because even the commit object is missing)
    // we can still try other commits based on the reflog. This can help in cases where another client pushed their changes out-of-order such that some files were uploaded to the remote, but not all.
    // Note that using the reflog for this is only acceptable because of the Rules of Forg, specifically that clients MUST NOT rewrite history, ever.
    // Therefore we know that all reflog entries are certainly part of the ref history and we just couldn't get the latest commit, rather an older one.
    if (options.attemptRecoveryFromSrcReflog) {
      const remoteReflog = await src.getReflog(ref);
      for (let i = remoteReflog.length - 1; i >= 0; i--) {
        const reflogEntry = remoteReflog[i];

        if (topCommitConsistency === SyncConsistency.AssumeTotalConnectivity && oldDstRefCommitHash === reflogEntry.newCommit) {
          // No-op: Destination is already here and we assume it to be fully connected
          return reflogEntry.newCommit;
        }

        if (await trySyncCommit(src, dst, reflogEntry.newCommit, syncOptions)) {
          syncedCommitHash = reflogEntry.newCommit;
          break;
        }
      }
    }
  }

  if (syncedCommitHash === undefined) {
    throw new Error(`Unable to sync, couldn't find a suitable commit for ref '${ref}' in the source repo`);
  }

  if (syncedCommitHash !== oldDstRefCommitHash) {
    const commit = await loadCommitObject(dst, syncedCommitHash);
    await updateRef(dst, ref, syncedCommitHash, commit.body.author, `${options.reflogOperationName}: ${commit.body.message}`);
  }

  return syncedCommitHash;
}

async function trySyncCommit(src: IReadOnlyRepo, dst: IRepo, commitHash: Hash, options: SyncOptions): Promise<boolean> {
  try {
    await syncCommit(src, dst, commitHash, options);
    return true;
  }
  catch (error) {
    if (error instanceof MissingObjectError) {
      return false;
    } else {
      throw error;
    }
  }
}

function getConsistency(strategy: SyncStrategy) {
  let topCommitConsistency: SyncConsistency;
  let otherCommitsConsistency: SyncConsistency;
  switch (strategy) {
    case SyncStrategy.Fast:
      topCommitConsistency = otherCommitsConsistency = SyncConsistency.AssumeTotalConnectivity;
      break;
    case SyncStrategy.FastAndDeepen:
      topCommitConsistency = otherCommitsConsistency = SyncConsistency.AssumeCommitTreeConnectivity;
      break;
    case SyncStrategy.FullSyncTopCommit:
      topCommitConsistency = SyncConsistency.AssumeObjectIntegrity;
      otherCommitsConsistency = SyncConsistency.AssumeTotalConnectivity;
      break;
    case SyncStrategy.FullSyncAll:
      topCommitConsistency = otherCommitsConsistency = SyncConsistency.AssumeObjectIntegrity;
      break;
    case SyncStrategy.OverwriteAll:
      topCommitConsistency = otherCommitsConsistency = SyncConsistency.Pessimistic;
      break;
    default:
      throw new Error(`Unknown strategy ${strategy}`);
  }

  return { topCommitConsistency, otherCommitsConsistency };
}
