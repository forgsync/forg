import { IRepo, Hash, walkTree, GitDbError, GitDbErrno } from '../../git';

export async function isTreeFullyReachable(repo: IRepo, treeHash: Hash): Promise<boolean> {
  try {
    for await (const leaf of walkTree(repo, treeHash)) {
      if (!(await repo.hasObject(leaf.hash))) {
        return false;
      }
    }
  } catch (error) {
    if (error instanceof GitDbError && error.errno === GitDbErrno.MissingObject) {
      return false;
    }

    throw error;
  }

  return true;
}
