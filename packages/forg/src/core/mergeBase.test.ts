import { Hash, Repo, createCommit } from '../git';
import { dummyPerson } from '../__testHelpers__/dummyPerson';
import { mergeBase } from './mergeBase';
import { InMemoryFS } from '@forgsync/simplefs';

describe('mergeBase', () => {
  let repo: Repo;
  let commits: { [key: string]: Hash };
  let commitsReverseMap: Map<Hash, string>;
  beforeEach(async () => {
    const fs = new InMemoryFS();
    repo = new Repo(fs);
    await repo.init();

    async function trackCommit(name: string, parents: Hash[]) {
      const hash = await createCommit(repo, {}, parents, name, dummyPerson());
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
  });

  function toCommitNames(hashes: Hash[]): string[] {
    return hashes.map((h) => {
      const name = commitsReverseMap.get(h);
      if (name === undefined) {
        throw new Error(`Unknown commit hash ${h}`);
      }

      return name;
    });
  }

  test('empty', async () => {
    const result = await mergeBase(repo, []);
    expect(toCommitNames(result.leafCommitIds)).toEqual([]);
    expect(toCommitNames(result.bestAncestorCommitIds)).toEqual([]);
  });

  test('A..B', async () => {
    const result = await mergeBase(repo, [commits.A, commits.B]);
    expect(toCommitNames(result.leafCommitIds)).toEqual(['B']);
    expect(toCommitNames(result.bestAncestorCommitIds)).toEqual(['A']);
  });

  test('B..A', async () => {
    const result = await mergeBase(repo, [commits.B, commits.A]);
    expect(toCommitNames(result.leafCommitIds)).toEqual(['B']);
    expect(toCommitNames(result.bestAncestorCommitIds)).toEqual(['A']);
  });

  test('A..G', async () => {
    const result = await mergeBase(repo, [commits.A, commits.G]);
    expect(toCommitNames(result.leafCommitIds)).toEqual(['G']);
    expect(toCommitNames(result.bestAncestorCommitIds)).toEqual(['A']);
  });

  test('D..K', async () => {
    const result = await mergeBase(repo, [commits.D, commits.K]);
    expect(toCommitNames(result.leafCommitIds)).toEqual(['K']);
    expect(toCommitNames(result.bestAncestorCommitIds)).toEqual(['D']);
  });

  test('G..H', async () => {
    const result = await mergeBase(repo, [commits.G, commits.H]);
    expect(toCommitNames(result.leafCommitIds)).toEqual(['G', 'H']);
    expect(toCommitNames(result.bestAncestorCommitIds)).toEqual(['F']);
  });

  test('G..G', async () => {
    const result = await mergeBase(repo, [commits.G, commits.G]);
    expect(toCommitNames(result.leafCommitIds)).toEqual(['G']);
    expect(toCommitNames(result.bestAncestorCommitIds)).toEqual(['G']);
  });

  test('G..K', async () => {
    const result = await mergeBase(repo, [commits.G, commits.K]);
    expect(toCommitNames(result.leafCommitIds)).toEqual(['G', 'K']);
    expect(toCommitNames(result.bestAncestorCommitIds)).toEqual(['F']);
  });

  test('F..I', async () => {
    const result = await mergeBase(repo, [commits.F, commits.I]);
    expect(toCommitNames(result.leafCommitIds)).toEqual(['F', 'I']);
    expect(toCommitNames(result.bestAncestorCommitIds)).toEqual(['D']);
  });

  test('G..I', async () => {
    const result = await mergeBase(repo, [commits.G, commits.I]);
    expect(toCommitNames(result.leafCommitIds)).toEqual(['G', 'I']);
    expect(toCommitNames(result.bestAncestorCommitIds)).toEqual(['A', 'D']);
  });

  test('G..H..K', async () => {
    const result = await mergeBase(repo, [commits.G, commits.H, commits.K]);
    expect(toCommitNames(result.leafCommitIds)).toEqual(['G', 'H', 'K']);
    expect(toCommitNames(result.bestAncestorCommitIds)).toEqual(['F']);
  });

  test('G..H..J..K', async () => {
    const result = await mergeBase(repo, [commits.G, commits.H, commits.J, commits.K]);
    expect(toCommitNames(result.leafCommitIds)).toEqual(['G', 'H', 'K']);
    expect(toCommitNames(result.bestAncestorCommitIds)).toEqual(['F']);
  });

  test('K..Z', async () => {
    const result = await mergeBase(repo, [commits.K, commits.Z]);
    expect(toCommitNames(result.leafCommitIds)).toEqual(['K', 'Z']);
    expect(toCommitNames(result.bestAncestorCommitIds)).toEqual([]);
  });
});
