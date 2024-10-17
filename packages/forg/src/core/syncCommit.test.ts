import { Hash, Repo, createCommit, loadCommitObject, loadTreeObject } from '../git';
import { dummyPerson } from '../__testHelpers__/dummyPerson';
import { syncCommit } from './syncCommit';
import { InMemoryFS } from '@forgsync/simplefs';
import { SyncConsistencyMode } from './model';

const encoder = new TextEncoder();
describe('syncCommit', () => {
  let origin: Repo;
  let commits: { [key: string]: Hash };
  beforeEach(async () => {
    const fs = new InMemoryFS();
    origin = new Repo(fs);
    await origin.init();

    async function trackCommit(name: string, parents: Hash[]) {
      const hash = await createCommit(origin, { type: 'tree', entries: { 'someFile.txt': { type: 'file', body: encoder.encode(`This is in commit ${name}`) } } }, parents, name, dummyPerson());
      commits[name] = hash;
    }
    commits = {};

    // A -- B
    //  \
    //   C -- D
    //    \
    //     E
    //
    await trackCommit('A', []);
    await trackCommit('B', [commits.A]);
    await trackCommit('C', [commits.A]);
    await trackCommit('D', [commits.C]);
    await trackCommit('E', [commits.C]);
  });

  test('Basics', async () => {
    const fs = new InMemoryFS();
    const local = new Repo(fs);
    await local.init();

    await syncCommit(origin, local, commits.E);
    expect(await local.hasObject(commits.E)).toBe(true);
    expect(await local.hasObject(commits.C)).toBe(true);
    expect(await local.hasObject(commits.A)).toBe(true);
    expect(await local.hasObject(commits.D)).toBe(false);
    expect(await local.hasObject(commits.B)).toBe(false);
  });

  test('Consistency modes', async () => {
    const fs = new InMemoryFS();
    const local = new Repo(fs);
    await local.init();

    await syncCommit(origin, local, commits.E);
    expect(await local.hasObject(commits.A)).toBe(true); // A exists after cloning

    // Delete A in local repo, then try cloning again with default consistency options
    await local.deleteObject(commits.A);
    await syncCommit(origin, local, commits.E);
    expect(await local.hasObject(commits.A)).toBe(false); // A still does NOT exist, since AssumeConnectivity will not traverse down to A if E already exists

    await syncCommit(origin, local, commits.E, {
      topCommitConsistency: SyncConsistencyMode.AssumeObjectIntegrity,
      otherCommitsConsistency: SyncConsistencyMode.AssumeObjectIntegrity,
      allowShallow: false,
    });
    expect(await local.hasObject(commits.A)).toBe(true); // A exists again after cloning with the higher consistency mode
  });

  test('shallow stops at missing commit', async () => {
    const fs = new InMemoryFS();
    const local = new Repo(fs);
    await local.init();

    await origin.deleteObject(commits.A);

    await syncCommit(origin, local, commits.E);
    expect(await local.hasObject(commits.E)).toBe(true);
    expect(await local.hasObject(commits.C)).toBe(true);
    expect(await local.hasObject(commits.A)).toBe(false); // We ended up with a shallow sync because commit A was missing in the origin!
  });

  test('shallow stops at partial commit', async () => {
    const fs = new InMemoryFS();
    const local = new Repo(fs);
    await local.init();

    const commitE = await loadCommitObject(origin, commits.C);
    const treeE = await loadTreeObject(origin, commitE.body.tree);
    const fileHash = treeE.body['someFile.txt'].hash;
    await origin.deleteObject(fileHash);

    await syncCommit(origin, local, commits.E);
    expect(await local.hasObject(commits.E)).toBe(true);
    expect(await local.hasObject(commits.C)).toBe(false); // We ended up with a shallow sync because commit C was incomplete in the origin!
    expect(await local.hasObject(commits.A)).toBe(false);
  });
});
