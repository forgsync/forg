import {
  IReadOnlyRepo,
  IRepo,
  updateRef,
} from '../git';
import { syncCommit } from './syncCommit';

export async function forcePush(local: IReadOnlyRepo, remote: IRepo, ref: string): Promise<void> {
  //console.log(`Pushing ${ref}`);
  const commitHash = await local.getRef(ref);
  if (!commitHash) {
    throw new Error(`Could not resolve ref ${ref} in local repo`);
  }

  const pushedHead = await syncCommit(local, remote, commitHash);
  await updateRef(remote, ref, commitHash, pushedHead.body.author, `push (force): ${pushedHead.body.message}`);
}
