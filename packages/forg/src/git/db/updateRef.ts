import { Hash, Person } from './model';
import { IRepo } from './Repo';

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
