import {
  Hash,
  IReadOnlyRepo,
  IRepo,
  loadCommitObject,
  MissingObjectError,
  updateRef,
} from '../git';
import { syncCommit } from './syncCommit';
import { SyncConsistency, SyncOptions } from "./model";

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
  reflogOperationName: 'fetch' | 'push (force)';

  /**
   * Options for syncing individual commits and associated objects.
   */
  commitSyncOptions: SyncOptions;
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

  let syncedCommitHash: Hash | undefined = undefined;
  const oldDstRefCommitHash = await dst.getRef(ref);
  if (options.commitSyncOptions.topCommitConsistency === SyncConsistency.AssumeConnectivity && oldDstRefCommitHash === srcRefCommitHash) {
    // No-op: Destination is already here and we assume it to be fully connected
    return srcRefCommitHash;
  }

  if (await trySyncCommit(src, dst, srcRefCommitHash, options.commitSyncOptions)) {
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

        if (options.commitSyncOptions.topCommitConsistency === SyncConsistency.AssumeConnectivity && oldDstRefCommitHash === reflogEntry.newCommit) {
          // No-op: Destination is already here and we assume it to be fully connected
          return reflogEntry.newCommit;
        }

        if (await trySyncCommit(src, dst, reflogEntry.newCommit, options.commitSyncOptions)) {
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
