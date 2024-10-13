import {
  CommitObject,
  Hash,
  IReadOnlyRepo,
  IRepo,
  MissingObjectError,
  updateRef,
} from '../git';
import { syncCommit } from './syncCommit';
import { ForgClientInfo, SyncOptions } from "./model";
import { tryParseForgRemoteRef } from './internal/tryParseForgRef';

/**
 * Fetches forg heads from the provided `remote` to the `local` repo.
 * The predicate selects which heads should be fetched. In most cases, a fetch would apply to all branches except for those of the current forg client uuid.
 */
export async function fetchRefs(origin: IReadOnlyRepo, local: IRepo, client: ForgClientInfo, options?: SyncOptions): Promise<void> {
  const remoteRefs = await origin.listRefs('refs/remotes');
  for (const ref of remoteRefs) {
    // Fetch all remote refs except for ours. Nobody else should touch our remote branch anyway in the remote repo (see The Rules of Forg)
    const refInfo = tryParseForgRemoteRef(ref);
    if (refInfo !== undefined && refInfo.client.uuid !== client.uuid) {
      await fetchRef(origin, local, ref, options);
    }
  }

  // Fetch all head refs
  const headRefs = await origin.listRefs('refs/heads');
  for (const ref of headRefs) {
    await fetchRef(origin, local, ref, options);
  }
}

/**
 * @returns the commit hash that was successfully fetched, if any. This method will first try to fetch the commit that the ref actually points to if it is a valid and complete commit,
 * but if that fails, we fall back to using the remote reflog instead.
 */
export async function fetchRef(origin: IReadOnlyRepo, local: IRepo, ref: string, options?: SyncOptions): Promise<Hash | undefined> {
  //console.log(`Fetching ${ref}`);
  const remoteReflog = await origin.getReflog(ref);
  const remoteRefHash = await origin.getRef(ref);
  let fetchedHead: { oid: Hash, commit: CommitObject } | undefined = undefined;

  if (remoteRefHash) {
    try {
      const commit = await syncCommit(origin, local, remoteRefHash, options);
      fetchedHead = {
        oid: remoteRefHash,
        commit,
      };
    }
    catch (error) {
      if (error instanceof MissingObjectError) {
        // If we couldn't fetch this commit in its entirety (e.g. perhaps we are missing one blob from one of the parent commits, but also possibly because even the commit object is missing)
        // we can still try other commits based on the reflog. This can help in cases where another client pushed their changes out-of-order such that some files were updated to the remote, but not all.
      } else {
        throw error;
      }
    }
  }

  if (fetchedHead === undefined) {
    for (let i = remoteReflog.length - 1; i >= 0; i--) {
      const reflogEntry = remoteReflog[i];
      try {
        const commit = await syncCommit(origin, local, reflogEntry.newCommit, options);
        fetchedHead = {
          oid: reflogEntry.newCommit,
          commit,
        };
        break;
      }
      catch (error) {
        if (error instanceof MissingObjectError) {
          // If we couldn't fetch this commit in its entirety (e.g. perhaps we are missing one blob from one of the parent commits, but also possibly because even the commit object is missing)
          // we can still try other commits based on the reflog. This can help in cases where another client pushed their changes out-of-order such that some files were updated to the remote, but not all.
        } else {
          throw error;
        }
      }
    }
  }

  if (fetchedHead !== undefined) {
    await updateRef(local, ref, fetchedHead.oid, fetchedHead.commit.body.author, `fetch: ${fetchedHead.commit.body.message}`);
    return fetchedHead.oid;
  }

  return undefined;
}
