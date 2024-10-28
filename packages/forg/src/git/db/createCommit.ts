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
