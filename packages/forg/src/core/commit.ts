import {
  Hash,
  IRepo,
  WorkingTreeFolder,
  createCommit,
  updateRef,
} from '../git';
import createCommitterInfo from './createCommitterInfo';
import { ForgBranch } from './model';

export async function commit(
  repo: IRepo,
  branch: ForgBranch,
  workingTree: WorkingTreeFolder,
  message: string,
): Promise<Hash> {
  const ref = `remotes/${branch.client}/${branch.branchName}`;
  const parentCommitId = await repo.getRef(ref);
  if (parentCommitId === undefined) {
    throw new Error(`No ref '${ref}'`);
  }
  const committer = createCommitterInfo(branch.client);
  const commitId = await createCommit(repo, workingTree, [parentCommitId], message, committer);
  await updateRef(repo, ref, commitId, committer, `commit: ${message}`);

  return commitId;
}
