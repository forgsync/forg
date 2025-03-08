import { Hash, IRepo, WorkingTreeFolder, createCommit, updateRef } from '../git';
import createCommitterInfo from './createCommitterInfo';
import { formatForgRef } from './internal/formatForgRef';
import { ForgClientInfo } from './model';

export async function commit(repo: IRepo, client: ForgClientInfo, branchName: string, workingTree: WorkingTreeFolder, message: string): Promise<Hash> {
  const ref = formatForgRef({ client, branchName });
  const parentCommitId = await repo.getRef(ref);

  const committer = createCommitterInfo(client);
  const commitId = await createCommit(repo, workingTree, parentCommitId !== undefined ? [parentCommitId] : [], message, committer);
  await updateRef(repo, ref, commitId, committer, `commit: ${message}`);

  return commitId;
}
