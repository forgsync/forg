import { Hash, Person, Type } from './model';
import { saveObject } from './objects';
import { IRepo } from './Repo';
import { WorkingTreeFolder, saveWorkingTree } from './workingTree';

export async function createCommit(
  repo: IRepo,
  workingTree: WorkingTreeFolder,
  parents: Hash[],
  message: string,
  author: Person,
  committer: Person = author,
): Promise<Hash> {
  const treeHash = await saveWorkingTree(repo, workingTree);
  const hash = await saveObject(repo, {
    type: Type.commit,
    body: {
      tree: treeHash,
      parents,
      author,
      committer,
      message,
    },
  });
  return hash;
}

export async function updateRef(
  repo: IRepo,
  ref: string,
  commitId: Hash,
  person: Person,
  reflogMessage: string,
): Promise<void> {
  // TODO: This method should be idempotent (as much as possible) when updating the ref and the reflog,
  // even though true atomicity atomic is not possible given the storage layer constraints we operate under
  const originalHash = await repo.getRef(ref);
  await repo.setRef(ref, commitId);

  const reflog = await repo.getReflog(ref);
  reflog.push({
    previousCommit: originalHash,
    newCommit: commitId,
    person: person,
    description: reflogMessage,
  });
  await repo.setReflog(ref, reflog);
}
