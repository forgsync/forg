import {
  IReadOnlyRepo,
  IRepo,
  loadCommitObject,
  updateRef,
} from '../git';
import { SyncOptions } from './model';
import { syncCommit } from './syncCommit';

export async function forcePush(local: IReadOnlyRepo, origin: IRepo, ref: string, options?: SyncOptions): Promise<void> {
  //console.log(`Pushing ${ref}`);
  const commitHash = await local.getRef(ref);
  if (!commitHash) {
    throw new Error(`Could not resolve ref ${ref} in local repo`);
  }

  await syncCommit(local, origin, commitHash, options);

  const remoteRefHash = await origin.getRef(ref);
  if (remoteRefHash !== commitHash) {
    const commit = await loadCommitObject(local, commitHash);
    await updateRef(origin, ref, commitHash, commit.body.author, `push (force): ${commit.body.message}`);
  }
}
