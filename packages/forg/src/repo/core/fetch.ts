import {
  CommitObject,
  Hash,
  IRepo,
  MissingObjectError,
} from '../git';
import { IReadOnlyRepo } from '../git/internal/Repo';
import { cloneCommit } from './cloneCommit';
import { CloneConsistencyOptions, defaultConsistencyOptions } from './consistency';
import tryParseForgRef, { ForgHeadInfo } from './internal/tryParseForgRef';

/**
 * Fetches forg heads from the provided `remote` to the `local` repo.
 * The predicate selects which heads should be fetched. In most cases, a fetch would apply to all branches except for those of the current forg client uuid.
 */
export async function fetchRefs(remote: IReadOnlyRepo, local: IRepo, predicate: (refInfo: ForgHeadInfo) => boolean, consistency: CloneConsistencyOptions = defaultConsistencyOptions()): Promise<void> {
  const refs = await remote.listRefs('refs/remotes');
  for (const ref of refs) {
    const refInfo = tryParseForgRef(ref);
    if (refInfo !== undefined && predicate(refInfo)) {
      await fetchRef(remote, local, ref, consistency);
    }
  }
}

/**
 * @returns the commit hash that was successfully fetched, if any. This method will first try to fetch the commit that the ref actually points to if it is a valid and complete commit,
 * but if that fails, we fall back to using the remote reflog instead.
 */
export async function fetchRef(remote: IReadOnlyRepo, local: IRepo, ref: string, consistency: CloneConsistencyOptions = defaultConsistencyOptions()): Promise<Hash | undefined> {
  //console.log(`Fetching ${ref}`);
  const remoteReflog = await remote.getReflog(ref);
  const remoteRefHash = await remote.getRef(ref);
  let fetchedHead: { oid: Hash, commit: CommitObject } | undefined = undefined;

  if (remoteRefHash) {
    try {
      const commit = await cloneCommit(remote, local, remoteRefHash, consistency);
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
    for (const reflogEntry of remoteReflog) {
      try {
        const commit = await cloneCommit(remote, local, reflogEntry.newCommit, consistency);
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
    const originalHash = await local.getRef(ref);
    const localReflog = await local.getReflog(ref);
    localReflog.push({
      previousCommit: originalHash,
      newCommit: fetchedHead.oid,
      person: fetchedHead.commit.body.author,
      description: `fetch: ${fetchedHead.commit.body.message}`,
    });
    await local.setRef(ref, remoteRefHash);
    await local.setReflog(ref, localReflog);

    return fetchedHead.oid;
  }
}
