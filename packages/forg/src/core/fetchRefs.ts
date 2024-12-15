import {
  IReadOnlyRepo, IRepo,
  forceFetchRef, FetchStrategy,
  SyncRefError, SyncRefErrorCode,
} from '../git';
import { ForgClientInfo } from './model';
import { tryParseForgRemoteRef } from './internal/tryParseForgRef';

/**
 * Fetches refs from the provided `remote` to the `local` repo.
 * This method will force-fetch all remotes managed by other forg clients, as well as all heads.
 * Optionally, if `branchName` is specified, only that branch (but still from every other client) will be fetched.
 */
export async function fetchRefs(local: IRepo, remote: IReadOnlyRepo, client: ForgClientInfo, strategy: FetchStrategy = FetchStrategy.DefaultForFetch, branchName?: string): Promise<void> {
  const remoteRefs = await remote.listRefs('refs/remotes');
  // Fetch all remote refs except for ours. Nobody else should touch our remote branch anyway in the remote repo (see The Rules of Forg)
  for (const ref of remoteRefs) {
    const refInfo = tryParseForgRemoteRef(ref);
    if (refInfo !== undefined &&
      refInfo.client.uuid !== client.uuid && // Only fetch remotes from other clients
      (branchName === undefined || refInfo.branchName === branchName)) {
      await tryForceFetchRef(local, remote, ref, strategy);
    }
  }

  // Fetch all head refs
  if (branchName !== undefined) {
    const ref = `refs/heads/${branchName}`;
    // NOTE: This ref might not exist. In that case, we simply swallow that error like all others.
    // TODO: If the remote head can be fast forwarded to the local ref, then we probably shouldn't touch the local ref (?)
    await tryForceFetchRef(local, remote, ref, strategy);
  }
  else {
    const headRefs = await remote.listRefs('refs/heads');
    for (const ref of headRefs) {
      await tryForceFetchRef(local, remote, ref, strategy);
    }
  }
}

async function tryForceFetchRef(local: IRepo, remote: IReadOnlyRepo, ref: string, strategy: FetchStrategy) {
  try {
    await forceFetchRef(local, remote, ref, strategy);
  } catch (error) {
    if (error instanceof SyncRefError && (error.code === SyncRefErrorCode.RefNotFound || error.code === SyncRefErrorCode.UnableToResolveRef)) {
      if (error.code === SyncRefErrorCode.RefNotFound) {
        // This is benign (e.g. the ref was just deleted in the remote or we attempted to sync a ref that doesn't exist)
        return;
      }
      if (error.code === SyncRefErrorCode.UnableToResolveRef) {
        // This is benign (e.g. another client is uploading out of order and hasn't uploaded all necessary objects yet)
        return;
      }
    }

    throw error;
  }
}
