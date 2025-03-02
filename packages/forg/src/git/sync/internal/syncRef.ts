import { GitDbErrno, GitDbError, Hash, IReadOnlyRepo, IRepo, loadCommitObject, updateRef } from '../../db';
import { syncCommit, SyncConsistency, SyncOptions } from './syncCommit';

export enum SyncStrategy {
  /**
   * Assumes a fully connected graph for all objects that exist in the destination.
   * This has potential issues both during `fetch` and `push`, and is NOT recommended as the default strategy at all times.
   *
   * ### Issues during `push`:
   *
   * A potential issue with this mode is that another client may have uploaded objects out of order and could potentially die before uploading the remaining objects,
   * leading to an incomplete destination that would not self-heal.
   * For example:
   * 1. Say another forg client created an empty folder with a single file named `abc` with some contents;
   * 2. Said client started force-pushing a new commit containing that new folder and the file. But the upload happened out of order, such that the tree representing the folder was uploaded, but the blob representing the file was not.
   * 3. Said client dies, never to be seen again. The destination will never get the blob object with the contents of file `abc`.
   * 4. The current client is doing a force-push of a completely unrelated commit, but which happens to also contains a new folder, with a single file also named `abc` and with the same contents from the other (now deceased) client.
   * 5. Because of `Fastest` mode, the current client would notice that the destination already has the tree object corresponding to the folder that contains the file (see step 2).
   *    HOWEVER, because we assumed graph connectivity, we assume that the blob referenced from the tree must  already exist in the destination, so we will not sync it.
   *    The outcome is that the blob for file `abc` will never be uploaded to the destination (violation of eventual consistency).
   *
   * Alternatives to this:
   *   - `FullSyncTopCommit` still does not guarantee eventual consistency in a broad sense, but at least ensures that the *top* commit is complete in the destination,
   *     though potentially at great impact to sync speed: O(n) with number of objects in the *top* commit (trees, blobs), regardless of whether they changed or not.
   *   - `FullSyncAll` completely addresses this concern, but at great impact to sync speed: O(n) with number of objects in the entire commit history (commits, trees, blobs), regardless of whether they changed or not.
   *
   * It can be a good idea to use a combination approach. For example, use `FullSyncTopCommit` or `FullSyncAll` at least once per day, but `Fastest` all the other times.
   * This would ensure the destination is made whole again in at most 1 day, even after the unlikely event of missing objects described above.
   *
   *
   * ### Issues during `fetch`:
   *
   * This is not recommended as it does not achieve eventual consistency when shallow histories are involved.
   * For example, one fetch attempt may succeed partially with a shallow commit history.
   * When using `Fastest` mode, a subsequent fetch attempt will not attempt to deepen the shallow history,
   * even if the complete history now exists in the destination.
   */
  Fastest,

  /**
   * Similar to `Fastest`, but will always traverse the source repo commits to ensure all parents also exists in the destination.
   * This is important during `fetch` to achieve eventual consistency in case the source repo had a shallow history that we can now deepen
   * (e.g. perhaps because during a previous fetch the destination was missing some objects that by now have been uploaded).
   * 
   * This is the recommended default for `fetch` in most cases.
   */
  FastAndDeepen,

  /**
   * Ensures that the top commit's tree and the tree's dependencies actually exist in the destination,
   * but assumes a connected graph for other commits. This means that if files were randomly deleted in the destination or uploaded out of order and/or failed to upload,
   * we guarantee that the top commit contents will be complete after this (but not necessarily its history -- objects [including commit objects] may be missing at the destination after a successful sync).
   * 
   * This is the recommended default for `push` in most cases. Other options to consider:
   *  - `Fastest` can be used sometimes as long as a more thorough mode is also used other times (e.g. use `FullSyncTopCommit` at least once a day, or allow the user to optionally request a more thorough push to recover from common problems);
   *  - `FullSyncAll` can be used to ensure that all objects are propagated to the remote, including objects that weren't synced before (e.g. because another client who would have uploaded those objects died while uploading them out of order).
   * 
   * See more in the comments for `Fastest`.
   * 
   * NOTE: This mode assumes object integrity at the destination (i.e. if an object file exists, it is assumed to be well formed). This is generally a reasonable assumption, unless files were corrupted by a malicious or uncompatible participant.
   * To recover from file corruption at the destination and forcefully re-upload all objects, use mode `OverwriteAll` instead.
   */
  FullSyncTopCommit,

  /**
   * Ensures that every referenced object actually exists in the destination.
   * This can be very slow, but it is useful to restore a bad destination after files were catastrophically deleted and/or failed to be uploaded by some client.
   * 
   * NOTE: This mode assumes object integrity at the destination (i.e. if an object file exists, it is assumed to be well formed). This is generally a reasonable assumption, unless files were corrupted by a malicious or uncompatible participant.
   * To recover from file corruption at the destination and forcefully re-upload all objects, use mode `OverwriteAll` instead.
   */
  FullSyncAll,

  /**
   * Overwrites every object in the destination.
   * This is only useful to recover if objects are tampered in the destination (i.e. the contents of some objects would have to be invalid). Otherwise, prefer `FullSyncAll` which does the same, but assumes object integrity and is therefore faster.
   */
  OverwriteAll,

  ///////////////////////////////////
  ///////////////////////////////////

  /**
   * The recommended default for `fetch` operations. This is equivalent to `FastAndDeepen`.
   * This achieves eventual consistency, but requires traversing the entire commit history in the local repo (to check if the history is shallow and can be deepened from the destination).
   * To optimize sync speed, you can use `DefaultForFetchFasterButRisky` some of the times, but it is still recommended to use `DefaultForFetch` at least every so often (e.g. once per day).
   * See more in the comments for `Fastest`.
   */
  DefaultForFetch,

  /**
   * A faster option that is also recommended for `fetch` operations, but which does not achieve eventual consistency in all cases.
   * This is equivalent to `Fastest`.
   * If you use this, it is recommended that you still use `DefaultForFetch` periodically (for example, once a day) to ensure eventual consistency.
   * See more in the comments for `Fastest`.
   */
  DefaultForFetchFasterButRisky,

  ///////////////////////////////////
  ///////////////////////////////////

  /**
   * The recommended default for `push` operations. This is equivalent to `FullSyncTopCommit`.
   * This achieves a relaxed definition of eventual consistency, where we ensure that the `top` commit is synced fully (all blobs and trees are guaranteed to be synced),
   * and commit history is partially synced (i.e. commit objects are synced, but not necessarily every blob and tree object of parent commits).
   * The situations where commit history isn't fully synced are very rare and unlikely, but possible.
   * For that reason, this is a reasonable choice in most practical scenarios.
   * This can get very slow if the top commit has lots of objects (trees / blobs).
   *
   * It is a good practice for consuming applications to allow the user to trigger a complete sync to recover under very specific situations.
   * In those cases, `DefaultForPushSlowButSafe` is recommended.
   * See more in the comments for `Fastest`.
   */
  DefaultForPush,

  /**
   * A faster option that is also recommended for `push` operations, but which does not achieve eventual consistency in important cases and could lead to an incomplete `top` commit
   * (i.e. some blobs and/or trees could be missing in the destination repo even after a successful sync). That would only happen under unlikely (but possible) circumstances.
   * If you use this, it is recommended that you still use `DefaultForPush` periodically (for example, once a day) to ensure eventual consistency.
   * This is equivalent to `Fastest`. See more in the comments for `Fastest`.
   */
  DefaultForPushFasterButRisky,

  /**
   * This achieves eventual consistency for `push` operations, but at the cost of ensuring that every single object referenced in the src repo actually exists in the destination.
   * This can get very slow for long commit histories and/or repo's with lots of objects.
   * This is equivalent to `FullSyncAll`. See more in the comments for `Fastest`.
   */
  DefaultForPushSlowerButSafe,
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

export enum SyncRefErrorCode {
  RefNotFound,
  UnableToResolveRef,
}

export class SyncRefError extends Error {
  code: SyncRefErrorCode;

  constructor(ref: string, code: SyncRefErrorCode) {
    super(`Error syncing ref '${ref}': ${SyncRefErrorCode[code]}`);
    this.code = code;
  }
}

/**
 * @returns the commit hash that was successfully synced.
 * This method will attempt to sync commits in the following order:
 * 1. If the ref points to a valid and complete (*) commit in the src repo, then that commit;
 * 2. If not AND `options.attemptRecoveryFromSrcReflog` is set, then it iterates backwards over the reflog in the src repo, and uses the first valid and complete (*) commit.
 *
 * (*) a commit is determined to be valid and complete when it can be fully synced from the source to the destination according to the specified sync strategy in `options.strategy`.
 */
export async function syncRef(src: IReadOnlyRepo, dst: IRepo, ref: string, options: SyncRefOptions): Promise<Hash> {
  //console.log(`Syncing ref '${ref}'`);
  const srcRefCommitHash = await src.getRef(ref);
  if (srcRefCommitHash === undefined) {
    throw new SyncRefError(ref, SyncRefErrorCode.RefNotFound);
  }

  let syncedCommitHash: Hash | undefined = undefined;
  const { topCommitConsistency, otherCommitsConsistency } = getConsistency(options.strategy);
  const oldDstRefCommitHash = await dst.getRef(ref);
  if (topCommitConsistency === SyncConsistency.AssumeTotalConnectivity && oldDstRefCommitHash === srcRefCommitHash) {
    // No-op: Destination is already here and we assume it to be fully connected
    return srcRefCommitHash;
  }

  const syncOptions: SyncOptions = {
    allowShallow: true,
    topCommitConsistency,
    otherCommitsConsistency,
  };
  if (await trySyncCommit(src, dst, srcRefCommitHash, syncOptions)) {
    syncedCommitHash = srcRefCommitHash;
  } else {
    // If we couldn't fetch the commit in its entirety (e.g. perhaps we are missing one blob from one of the parent commits, but also possibly because even the commit object is missing)
    // we can still try other commits based on the reflog. This can help in cases where another client pushed their changes out-of-order such that some files were uploaded to the destination, but not all.
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
    throw new SyncRefError(ref, SyncRefErrorCode.UnableToResolveRef);
  }

  if (syncedCommitHash !== oldDstRefCommitHash) {
    const commit = await loadCommitObject(dst, syncedCommitHash);
    await updateRef(dst, ref, syncedCommitHash, commit.body.author, `${options.reflogOperationName}: ${commit.body.message}`);
  }

  return syncedCommitHash;
}

async function trySyncCommit(src: IReadOnlyRepo, dst: IRepo, commitId: Hash, options: SyncOptions): Promise<boolean> {
  try {
    await syncCommit(src, dst, commitId, options);
    return true;
  } catch (error) {
    if (error instanceof GitDbError && error.errno === GitDbErrno.MissingObject) {
      return false;
    } else {
      throw error;
    }
  }
}

function getConsistency(strategy: SyncStrategy): {
  topCommitConsistency: SyncConsistency;
  otherCommitsConsistency: SyncConsistency;
} {
  switch (strategy) {
    case SyncStrategy.Fastest:
    case SyncStrategy.DefaultForFetchFasterButRisky:
    case SyncStrategy.DefaultForPushFasterButRisky:
      return {
        topCommitConsistency: SyncConsistency.AssumeTotalConnectivity,
        otherCommitsConsistency: SyncConsistency.AssumeTotalConnectivity,
      };
    case SyncStrategy.FastAndDeepen:
    case SyncStrategy.DefaultForFetch:
      return {
        topCommitConsistency: SyncConsistency.AssumeCommitTreeConnectivity,
        otherCommitsConsistency: SyncConsistency.AssumeCommitTreeConnectivity,
      };
    case SyncStrategy.FullSyncTopCommit:
    case SyncStrategy.DefaultForPush:
      return {
        topCommitConsistency: SyncConsistency.AssumeObjectIntegrity,
        otherCommitsConsistency: SyncConsistency.AssumeTotalConnectivity,
      };
    case SyncStrategy.FullSyncAll:
    case SyncStrategy.DefaultForPushSlowerButSafe:
      return {
        topCommitConsistency: SyncConsistency.AssumeObjectIntegrity,
        otherCommitsConsistency: SyncConsistency.AssumeObjectIntegrity,
      };
    case SyncStrategy.OverwriteAll:
      return {
        topCommitConsistency: SyncConsistency.Pessimistic,
        otherCommitsConsistency: SyncConsistency.Pessimistic,
      };
    default:
      throw new Error(`Unknown strategy ${strategy}`);
  }
}
