import { IRepo, Hash, walkTree, MissingObjectError } from '../../git';

export async function isTreeFullyReachable(repo: IRepo, treeHash: Hash): Promise<boolean> {
  try {
    for await (const leaf of walkTree(repo, treeHash)) {
      if (!(await repo.hasObject(leaf.hash))) {
        return false;
      }
    }
  } catch (error) {
    if (error instanceof MissingObjectError) {
      return false;
    }

    throw error;
  }

  return true;
}
