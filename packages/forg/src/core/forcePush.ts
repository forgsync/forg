import {
  IReadOnlyRepo,
  IRepo,
  updateRef,
} from '../git';
import { SyncConsistencyOptions } from './model';
import { syncCommit } from './syncCommit';

export async function forcePush(local: IReadOnlyRepo, origin: IRepo, ref: string, consistency?: SyncConsistencyOptions): Promise<void> {
  //console.log(`Pushing ${ref}`);
  const commitHash = await local.getRef(ref);
  if (!commitHash) {
    throw new Error(`Could not resolve ref ${ref} in local repo`);
  }

  const pushedHead = await syncCommit(local, origin, commitHash, consistency);
  await updateRef(origin, ref, commitHash, pushedHead.body.author, `push (force): ${pushedHead.body.message}`);
}
