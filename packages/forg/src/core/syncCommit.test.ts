import { Hash, Repo, createCommit } from '../git';
import { dummyPerson } from '../__testHelpers__/dummyPerson';
import { syncCommit } from './syncCommit';
import { InMemoryFS } from '@forgsync/simplefs';
import { ConsistencyMode } from './consistency';

describe('syncCommit', () => {
  let remote: Repo;
  let commits: { [key: string]: Hash };
  beforeEach(async () => {
    const fs = new InMemoryFS();
    remote = new Repo(fs);
    await remote.init();

    async function trackCommit(name: string, parents: Hash[]) {
      const hash = await createCommit(remote, { type: 'tree', entries: {} }, parents, name, dummyPerson());
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

    await syncCommit(remote, local, commits.E);
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

    await syncCommit(remote, local, commits.E);
    expect(await local.hasObject(commits.A)).toBe(true); // A exists after cloning

    // Delete A in local repo, then try cloning again with default consistency options
    await local.deleteObject(commits.A);
    await syncCommit(remote, local, commits.E);
    expect(await local.hasObject(commits.A)).toBe(false); // A still does NOT exist, since AssumeConnectivity will not traverse down to A if E already exists

    await syncCommit(remote, local, commits.E, { headCommitConsistency: ConsistencyMode.AssumeObjectIntegrity, parentCommitsConsistency: ConsistencyMode.AssumeObjectIntegrity });
    expect(await local.hasObject(commits.A)).toBe(true); // A exists again after cloning with the higher consistency mode
  });
});
