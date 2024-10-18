import {
  Hash,
  IReadOnlyRepo,
  IRepo,
} from '../git';
import { SyncConsistency } from './model';
import { syncRef, SyncRefOptions } from './syncRef';

export async function forcePush(src: IReadOnlyRepo, dst: IRepo, ref: string): Promise<Hash> {
  //console.log(`Pushing ref '${ref}'`);
  const syncRefOptions: SyncRefOptions = {
    attemptRecoveryFromSrcReflog: false, // Local repo should always be consistent, so there's no need to leverage reflog
    reflogOperationName: 'push (force)',
    commitSyncOptions: {
      // Destination repo may not be consistent (e.g. another party could have deleted objects that we care about), so ensure we are pushing all that matter
      topCommitConsistency: SyncConsistency.AssumeObjectIntegrity,
      otherCommitsConsistency: SyncConsistency.AssumeConnectivity,
      allowShallow: true, // Because the local repo could be shallow as a result of a previous shallow fetch

      // TODO: It seems safe to leave this as false. Example scenario that would seem interesting, but even then we wouldn't need attemptDeepen == true:
      // - client2 fetched a partial git history of client1
      // - client2 performed consolidation, and created a new merged commit from the heads of client2 and client1.
      //   That merge commit now only has partial history (because the history of client1 was incomplete at the time of fetching)
      // - client2 pushed the consolidated commit, and now the remote will also only have partial history
      // - At a later point, client2 or any other client might fetch the commits that had been missing before. When pushing, we would ideally want to push those to the remote as well
      // - Note: This is probably moot because if it is truly the case that said client was able to fetch the missing commits at some point, it must be because those commits made it to the remote, hence the remote isn't shallow anymore.
      // 
      // Therefore, it seems indeed safe to leave this as false. Hmmm.
      attemptDeepen: false,
    },
  };
  return await syncRef(src, dst, ref, syncRefOptions);
}
