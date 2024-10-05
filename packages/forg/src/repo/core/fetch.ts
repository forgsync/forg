import {
  Hash,
  IRepo,
  loadCommitObject,
  loadTreeObject,
  MissingObjectError,
} from '../git';
import { isFile } from '../git/internal/util';
import tryParseForgRef, { ForgHeadInfo } from './internal/tryParseForgRef';

/**
 * 
 * @param remote 
 * @param local 
 * @param predicate 
 */
export async function fetch(remote: IRepo, local: IRepo, predicate: (refInfo: ForgHeadInfo) => boolean): Promise<void> {
  const refs = await remote.listRefs('refs/remotes');
  for (const ref of refs) {
    const refInfo = tryParseForgRef(ref);
    if (refInfo !== undefined && predicate(refInfo)) {
      await fetchRef(remote, local, ref);
    }
  }
}

/**
 * @returns true if a viable commit was fetched. Note that this can occur when the ref actually points at a valid and complete commit,
 * but also when that approach failed but we were able to fetch another commit from the reflog instead.
 */
async function fetchRef(remote: IRepo, local: IRepo, ref: string): Promise<boolean> {
  //console.log(`Fetching ${ref}`);
  const reflog = await remote.getReflog(ref);
  const commitHash = await remote.getRef(ref);

  let fetchedViableCommit = false;
  if (commitHash) {
    try {
      await fetchCommit(remote, local, commitHash);
      fetchedViableCommit = true;
    }
    catch (error) {
      if (error instanceof MissingObjectError) {
        // If we couldn't fetch this commit in its entirety (e.g. perhaps we are missing one blob from one of the parent commits, but also possibly because even the commit object is missing)
        // we can still try other commits based on the reflog. This can help in cases where another client pushed their changes out-of-order such that some files were updated in the remote, but not all.
      } else {
        throw error;
      }
    }
  }

  if (!fetchedViableCommit) {
    for (const reflogEntry of reflog) {
      try {
        await fetchCommit(remote, local, reflogEntry.newCommit);
        fetchedViableCommit = true;
        break;
      }
      catch (error) {
        if (error instanceof MissingObjectError) {
          // If we couldn't fetch this commit in its entirety (e.g. perhaps we are missing one blob from one of the parent commits, but also possibly because even the commit object is missing)
          // we can still try other commits based on the reflog. This can help in cases where another client pushed their changes out-of-order such that some files were updated in the remote, but not all.
        } else {
          throw error;
        }
      }
    }
  }

  await local.setRef(ref, commitHash);
  await local.setReflog(ref, reflog);

  return fetchedViableCommit;
}

async function fetchCommit(remote: IRepo, local: IRepo, commitHash: string) {
  //console.log(`Fetching commit ${commitHash}`);
  let commitsToFetch = [commitHash];
  while (commitsToFetch.length > 0) {
    const nextCommitsToFetch: Hash[] = [];
    for (const commitHash of commitsToFetch) {
      if (!await local.hasObject(commitHash)) {
        const raw = await remote.loadRawObject(commitHash);
        await local.saveRawObject(commitHash, raw);
      }

      const commit = await loadCommitObject(local, commitHash);
      await fetchTree(remote, local, commit.body.tree);

      nextCommitsToFetch.push(...commit.body.parents);
    }

    commitsToFetch = nextCommitsToFetch;
  }
}

async function fetchTree(remote: IRepo, local: IRepo, treeHash: string) {
  //console.log(`Fetching tree ${treeHash}`);
  if (!await local.hasObject(treeHash)) {
    const raw = await remote.loadRawObject(treeHash);
    await local.saveRawObject(treeHash, raw);
  }

  const tree = await loadTreeObject(local, treeHash);
  for (const name of Object.keys(tree.body)) {
    const { mode, hash } = tree.body[name];
    if (isFile(mode)) {
      await fetchBlob(remote, local, hash);
    } else {
      await fetchTree(remote, local, hash);
    }
  }
}

async function fetchBlob(remote: IRepo, local: IRepo, blobHash: string) {
  //console.log(`Fetching blob ${blobHash}`);
  if (!await local.hasObject(blobHash)) {
    const raw = await remote.loadRawObject(blobHash);
    await local.saveRawObject(blobHash, raw);
  }
}
