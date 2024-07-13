import {
  Hash, IRepo, Repo,
  createCommit,
  loadCommitObject,
} from "../git";
import { dummyPerson } from "../__testHelpers__/dummyPerson";
import { mergeBase, MergeBaseResult } from './mergeBase';
import { InMemoryFS } from "@forgsync/simplefs";

describe('mergeBase', () => {
  let repo: Repo;
  let commitA: Hash;
  let commitB: Hash;
  let commitC: Hash;
  let commitD: Hash;
  let commitE: Hash;
  let commitF: Hash;
  let commitG: Hash;
  let commitH: Hash;
  let commitI: Hash;
  let commitJ: Hash;
  let commitK: Hash;
  let commitZ: Hash;
  beforeEach(async () => {
    const fs = new InMemoryFS();
    repo = new Repo(fs);
    await repo.init();

    // A -- B -- C -- G
    //  \           /
    //   D -- E -- F -- H
    //    \         \
    //     I ------- J -- K
    // Z
    commitA = await createCommit(repo, {}, [], 'A', dummyPerson());
    commitB = await createCommit(repo, {}, [commitA], 'B', dummyPerson());
    commitC = await createCommit(repo, {}, [commitB], 'C', dummyPerson());
    commitD = await createCommit(repo, {}, [commitA], 'D', dummyPerson());
    commitE = await createCommit(repo, {}, [commitD], 'E', dummyPerson());
    commitF = await createCommit(repo, {}, [commitE], 'F', dummyPerson());
    commitG = await createCommit(repo, {}, [commitC, commitF], 'G', dummyPerson());
    commitH = await createCommit(repo, {}, [commitF], 'H', dummyPerson());
    commitI = await createCommit(repo, {}, [commitD], 'I', dummyPerson());
    commitJ = await createCommit(repo, {}, [commitF, commitI], 'J', dummyPerson());
    commitK = await createCommit(repo, {}, [commitJ], 'K', dummyPerson());
    commitZ = await createCommit(repo, {}, [], 'Z', dummyPerson());

    // console.log({
    //   commitA,
    //   commitB,
    //   commitC,
    //   commitD,
    //   commitE,
    //   commitF,
    //   commitG,
    //   commitH,
    //   commitI,
    //   commitJ,
    //   commitK,
    //   commitZ,
    // });
  });

  test('empty', async () => {
    const result = await mergeBase(repo, []);
    expect(result.leafCommitIds).toEqual([]);
    expect(result.bestAncestorCommitIds).toHaveLength(0);
  });

  test('A..B', async () => {
    const result = await mergeBase(repo, [commitA, commitB]);
    expect(result.leafCommitIds).toEqual([commitB]);
    await assertCommit(repo, result, [commitA]);
  });

  test('B..A', async () => {
    const result = await mergeBase(repo, [commitB, commitA]);
    expect(result.leafCommitIds).toEqual([commitB]);
    await assertCommit(repo, result, [commitA]);
  });

  test('A..G', async () => {
    const result = await mergeBase(repo, [commitA, commitG]);
    expect(result.leafCommitIds).toEqual([commitG]);
    await assertCommit(repo, result, [commitA]);
  });

  test('D..K', async () => {
    const result = await mergeBase(repo, [commitD, commitK]);
    expect(result.leafCommitIds).toEqual([commitK]);
    await assertCommit(repo, result, [commitD]);
  });

  test('G..H', async () => {
    const result = await mergeBase(repo, [commitG, commitH]);
    expect(result.leafCommitIds).toEqual([commitG, commitH]);
    await assertCommit(repo, result, [commitF]);
  });

  test('G..G', async () => {
    const result = await mergeBase(repo, [commitG, commitG]);
    expect(result.leafCommitIds).toEqual([commitG]);
    await assertCommit(repo, result, [commitG]);
  });

  test('G..K', async () => {
    const result = await mergeBase(repo, [commitG, commitK]);
    expect(result.leafCommitIds).toEqual([commitG, commitK]);
    await assertCommit(repo, result, [commitF]);
  });

  test('F..I', async () => {
    const result = await mergeBase(repo, [commitF, commitI]);
    expect(result.leafCommitIds).toEqual([commitF, commitI]);
    await assertCommit(repo, result, [commitD]);
  });

  test('G..I', async () => {
    const result = await mergeBase(repo, [commitG, commitI]);
    expect(result.leafCommitIds).toEqual([commitG, commitI]);
    await assertCommit(repo, result, [commitA, commitD]);
  });

  test('G..H..K', async () => {
    const result = await mergeBase(repo, [commitG, commitH, commitK]);
    expect(result.leafCommitIds).toEqual([commitG, commitH, commitK]);
    await assertCommit(repo, result, [commitF]);
  });

  test('G..H..J..K', async () => {
    const result = await mergeBase(repo, [commitG, commitH, commitJ, commitK]);
    expect(result.leafCommitIds).toEqual([commitG, commitH, commitK]);
    await assertCommit(repo, result, [commitF]);
  });

  test('K..Z', async () => {
    const result = await mergeBase(repo, [commitK, commitZ]);
    expect(result.leafCommitIds).toEqual([commitK, commitZ]);
    await assertCommit(repo, result, []);
  });
});

async function assertCommit(repo: IRepo, actual: MergeBaseResult, expected: Hash[]) {
  expect(actual.bestAncestorCommitIds).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++) {
    const actualMessage = (await loadCommitObject(repo, actual.bestAncestorCommitIds[i]))?.body.message;
    const expectedMessage = (await loadCommitObject(repo, expected[i]))?.body.message;

    if (expectedMessage !== actualMessage) {
      expect(actualMessage).toEqual(expectedMessage);
    }
  }
}
