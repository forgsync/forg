import {
  Hash,
  IReadOnlyRepo,
  IRepo,
  loadCommitObject,
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
  let fetchedCommitHash: Hash | undefined = undefined;

  if (remoteRefHash) {
    try {
      await syncCommit(origin, local, remoteRefHash, options);
      fetchedCommitHash = remoteRefHash;
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

  if (fetchedCommitHash === undefined) {
    for (let i = remoteReflog.length - 1; i >= 0; i--) {
      const reflogEntry = remoteReflog[i];
      try {
        await syncCommit(origin, local, reflogEntry.newCommit, options);
        fetchedCommitHash = reflogEntry.newCommit;
        break;
      }
      catch (error) {
        if (error instanceof MissingObjectError) {
          // If we couldn't fetch this commit in its entirety (e.g. perhaps we are missing one blob from one of the parent commits, but also possibly because even the commit object is missing)
          // we can still try other commits based on the reflog. This can help in cases where another client pushed their changes out-of-order such that some files were updated to the remote, but not all.
          // Note that using the reflog for this is only acceptable because of the Rules of Forg, specifically that clients MUST NOT rewrite history, ever.
          // Therefore we know that all reflog entries are certainly part of the ref history and we just couldn't get the latest commit, rather an older one.
        } else {
          throw error;
        }
      }
    }
  }

  if (fetchedCommitHash !== undefined) {
    const localRefHash = await local.getRef(ref);
    if (localRefHash !== fetchedCommitHash) {
      const commit = await loadCommitObject(local, fetchedCommitHash);
      await updateRef(local, ref, fetchedCommitHash, commit.body.author, `fetch: ${commit.body.message}`);
    }
    return fetchedCommitHash;
  }

  return undefined;
}
