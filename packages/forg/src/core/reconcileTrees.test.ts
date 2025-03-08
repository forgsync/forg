import { GitTreeFS, Hash, InitMode, Repo, createCommit, loadCommitObject } from '../git';
import { dummyPerson } from '../__testHelpers__/dummyPerson';
import { reconcileTrees } from './reconcileTrees';
import { InMemoryFS } from '@forgsync/simplefs';
import { ForgClientInfo } from './model';

describe('reconcileTrees', () => {
  let repo: Repo;
  let commits: { [key: string]: Hash };
  let commitsReverseMap: Map<Hash, string>;
  beforeEach(async () => {
    const fs = new InMemoryFS();
    repo = new Repo(fs);
    await repo.init(InitMode.CreateIfNotExists);

    async function trackCommit(name: string, parents: Hash[]) {
      const hash = await createCommit(repo, { type: 'tree', entries: {} }, parents, name, dummyPerson(Object.keys(commits).length));
      commits[name] = hash;
      commitsReverseMap.set(hash, name);
    }
    commits = {};
    commitsReverseMap = new Map<Hash, string>();

    // A -- B -- C -- G
    //  \           /
    //   D -- E -- F -- H
    //    \         \
    //     I ------- J -- K
    //
    // Z
    //
    await trackCommit('A', []);
    await trackCommit('B', [commits.A]);
    await trackCommit('C', [commits.B]);
    await trackCommit('D', [commits.A]);
    await trackCommit('E', [commits.D]);
    await trackCommit('F', [commits.E]);
    await trackCommit('G', [commits.C, commits.F]);
    await trackCommit('H', [commits.F]);
    await trackCommit('I', [commits.D]);
    await trackCommit('J', [commits.F, commits.I]);
    await trackCommit('K', [commits.J]);
    await trackCommit('Z', []);

    //console.log(`Setup: ${JSON.stringify({ commits }, undefined, 2)}`);
  });

  function toCommitNames(...hashes: (Hash | undefined)[]): string[] {
    return hashes.map((h) => {
      if (h === undefined) {
        return '<undefined>';
      }

      const name = commitsReverseMap.get(h);
      if (name === undefined) {
        return `<unknown commit hash ${h}>`;
      }

      return name;
    });
  }

  test('Fast forwards', async () => {
    const me: ForgClientInfo = { uuid: 'client2' };
    await repo.setRef('refs/remotes/client1/main', commits.A);
    await repo.setRef('refs/remotes/client2/main', commits.B);
    await repo.setRef('refs/remotes/client3/main', commits.C);

    const newCommitHash = await reconcileTrees(repo, me, 'main', dummyMergeFunc);

    expect(toCommitNames(await repo.getRef('refs/remotes/client1/main'))).toEqual(['A']); // unchanged
    expect(toCommitNames(await repo.getRef('refs/remotes/client3/main'))).toEqual(['C']); // unchanged

    expect(newCommitHash).toBe(commits.C);
    expect(toCommitNames(await repo.getRef('refs/remotes/client2/main'))).toEqual(['C']);
  });

  test('Reconciles two heads into one merge commit', async () => {
    const me: ForgClientInfo = { uuid: 'client1' };
    await repo.setRef('refs/remotes/client1/main', commits.B);
    await repo.setRef('refs/remotes/client2/main', commits.D);
    await repo.setRef('refs/remotes/client3/main', commits.E);

    const newCommitHash = await reconcileTrees(repo, me, 'main', dummyMergeFunc);

    expect(await repo.getRef('refs/remotes/client1/main')).toBe(newCommitHash);
    expect(await repo.getRef('refs/remotes/client2/main')).toBe(commits.D); // unchanged
    expect(await repo.getRef('refs/remotes/client3/main')).toBe(commits.E); // unchanged
    expect(commitsReverseMap.get(newCommitHash)).toBeUndefined();
    const newCommit = await loadCommitObject(repo, newCommitHash);
    expect(toCommitNames(...newCommit.body.parents)).toEqual(['B', 'E']);
  });

  test('Reconciles three heads into two merge commits', async () => {
    const me: ForgClientInfo = { uuid: 'client1' };
    await repo.setRef('refs/remotes/client1/main', commits.B);
    await repo.setRef('refs/remotes/client2/main', commits.E);
    await repo.setRef('refs/remotes/client3/main', commits.I);

    // Before:
    //   A -- B (client1)
    //    \
    //     D -- E (client2)
    //      \
    //       I (client3)
    //
    //
    // Expected after:
    //   A ----- B -- new1 --- new2 (client1)
    //    \           /        /
    //     D ------- E        /
    //      \    (client2)   /
    //       \              /
    //        \----------- I
    //                 (client3)

    const newCommitHash = await reconcileTrees(repo, me, 'main', dummyMergeFunc);

    expect(await repo.getRef('refs/remotes/client1/main')).toBe(newCommitHash);
    expect(await repo.getRef('refs/remotes/client2/main')).toBe(commits.E); // unchanged
    expect(await repo.getRef('refs/remotes/client3/main')).toBe(commits.I); // unchanged
    expect(commitsReverseMap.get(newCommitHash)).toBeUndefined();
    const newCommit2 = await loadCommitObject(repo, newCommitHash);
    const knownParentIndex = newCommit2.body.parents.findIndex((hash) => commitsReverseMap.has(hash));
    const knownParentHash = newCommit2.body.parents[knownParentIndex];
    const otherParentHash = newCommit2.body.parents[1 - knownParentIndex];
    expect(toCommitNames(knownParentHash)).toEqual(['I']);

    const newCommit1 = await loadCommitObject(repo, otherParentHash);
    expect(toCommitNames(...newCommit1.body.parents)).toEqual(['B', 'E']);
  });
});

async function dummyMergeFunc(a: GitTreeFS, _b: GitTreeFS): Promise<GitTreeFS> {
  // Just return the left side always
  return a;
}
