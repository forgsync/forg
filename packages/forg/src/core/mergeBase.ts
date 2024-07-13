import { CommitObject, Hash, IRepo, loadCommitObject } from '../git';

interface TraversingHead {
  headIndex: number;
  commitId: string;
}

export interface MergeBaseResult {
  /**
   * The latest common ancestor(s) that is(are) common to all the provided commit id's.
   * In most common cases, this will be a single commit that is the one where history diverged.
   * But in some cases, there are multiple valid answers.
   * See also: https://git-scm.com/docs/git-merge-base
   * > "When the history involves criss-cross merges, there can be more than one best common ancestor for two commits"
   */
  bestAncestorCommitIds: Hash[];

  /**
   * The distinct leaves. This is a subset of the provide commit id's, and omits commits
   * that are ancestors of other commits already listed.
   */
  leafCommitIds: Hash[];
}

/**
 * Computes the latest common ancestor(s) (if any) among the provided commit id's,
 * as well as the distinct leaves that are relevant in case all the provided commit's are to be merged.
 * The computation of the latest common ancestor is approximately (perhaps the same?) as git's `merge-base --octopus --all` command.
 * See also:
 * - https://git-scm.com/docs/git-merge-base
 * - https://github.blog/2022-08-30-gits-database-internals-ii-commit-history-queries/
 */
export async function mergeBase(repo: IRepo, commitIds: Hash[]): Promise<MergeBaseResult> {
  // Step 1: Ensure inputs are distinct
  commitIds = Array.from(new Set<Hash>(commitIds));

  // Breadth-first-search with multiple heads
  let heads: TraversingHead[] = commitIds.map((commitId, headIndex) => ({ headIndex, commitId }));
  const bestCommitIds = new Set<Hash>();
  const visited = new Map<Hash, Set<number>>();

  const errors: unknown[] = [];
  while (heads.length > 0) {
    for (const { commitId, headIndex } of heads) {
      const set = markVisited(visited, commitId, headIndex);
      if (set.size === commitIds.length) {
        bestCommitIds.add(commitId);
      }
    }

    if (bestCommitIds.size > 0) {
      return {
        bestAncestorCommitIds: Array.from(bestCommitIds),
        leafCommitIds: computeDistinctLeaves(commitIds, visited),
      };
    }

    const oldHeads = heads;
    heads = [];
    for (const { commitId, headIndex } of oldHeads) {
      let commit: CommitObject | undefined;
      try {
        commit = await loadCommitObject(repo, commitId);
      } catch (error) {
        // Keep going, worst case we will fail to find a suitable merge base
        errors.push(error);
      }
      if (commit === undefined) {
        continue;
      }

      for (const parent of commit.body.parents) {
        let set = visited.get(parent);
        if (set === undefined || !set.has(headIndex)) {
          heads.push({ headIndex, commitId: parent });
        }
      }
    }
  }

  if (errors.length > 0) {
    const details = errors.map((e) =>
      e instanceof Error ? `  Error ${e.name}, details: ${e.message}` : `  ${e}`,
    );
    throw new Error(
      `Unable to find merge base, and errors occurred during traversal\n${details.join('\n')}`,
    );
  }

  return {
    bestAncestorCommitIds: [],
    leafCommitIds: computeDistinctLeaves(commitIds, visited),
  };
}

function markVisited(
  visited: Map<Hash, Set<number>>,
  commitId: Hash,
  headIndex: number,
): Set<number> {
  let set = visited.get(commitId);
  if (!set) {
    set = new Set<number>();
    visited.set(commitId, set);
  }
  set.add(headIndex);
  return set;
}

function computeDistinctLeaves(commitIds: Hash[], visited: Map<Hash, Set<number>>) {
  const leafCommitIds: Hash[] = [];
  for (const commitId of commitIds) {
    const set = visited.get(commitId);
    if (set === undefined) {
      throw new Error(); // coding defect
    }
    if (set.size == 1) {
      leafCommitIds.push(commitId);
    }
  }
  return leafCommitIds;
}
