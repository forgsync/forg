import {
  IRepo,
} from '../git';
import { IReadOnlyRepo } from '../git/internal/Repo';
import { cloneCommit } from './cloneCommit';

export async function forcePush(local: IReadOnlyRepo, remote: IRepo, ref: string): Promise<void> {
  //console.log(`Pushing ${ref}`);
  const commitHash = await local.getRef(ref);
  if (!commitHash) {
    throw new Error(`Could not resolve ref ${ref} in local repo`);
  }

  const pushedHead = await cloneCommit(local, remote, commitHash);

  const remoteOldRef = await remote.getRef(ref);
  const remoteReflog = await remote.getReflog(ref);
  remoteReflog.push({
    previousCommit: remoteOldRef,
    newCommit: commitHash,
    person: pushedHead.body.author,
    description: `push (force): ${pushedHead.body.message}`,
  });
}
