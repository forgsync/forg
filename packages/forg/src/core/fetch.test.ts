import { Hash, Repo, createCommit, updateRef } from '../git';
import { dummyPerson } from '../__testHelpers__/dummyPerson';
import { fetchRefs } from './fetch';
import { InMemoryFS } from '@forgsync/simplefs';

const TEST_REF = 'refs/remotes/client1/main';
describe('fetch', () => {
  let remote: Repo;
  let commits: { [key: string]: Hash };
  beforeEach(async () => {
    const fs = new InMemoryFS();
    remote = new Repo(fs);
    await remote.init();

    async function trackCommit(name: string, parents: Hash[]) {
      const hash = await createCommit(remote, { type: 'tree', entries: {} }, parents, name, dummyPerson());
      commits[name] = hash;
      await updateRef(remote, TEST_REF, hash, dummyPerson(), `Committed: ${name}`);
    }
    commits = {};

    // A -- B
    //  \
    //   C -- D
    //    \
    //     E (refs/remotes/client1/main)
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

    await fetchRefs(remote, local, () => true);
    expect(await local.getRef(TEST_REF)).toBe(commits.E);
    expect(await local.hasObject(commits.E)).toBe(true);
    expect(await local.hasObject(commits.C)).toBe(true);
    expect(await local.hasObject(commits.A)).toBe(true);
    expect(await local.hasObject(commits.D)).toBe(false);
    expect(await local.hasObject(commits.B)).toBe(false);
  });

  test('Uses reflog if top commit is malformed', async () => {
    const fs = new InMemoryFS();
    const local = new Repo(fs);
    await local.init();

    await remote.deleteObject(commits.E); // ref still points here, but we delete the object (e.g. simulate that this wasn't uploaded yet to the remote)

    await fetchRefs(remote, local, () => true); // would attempt to sync commit E, which would fail, and then falls back to reflog -- the next entry would be commit D
    expect(await local.getRef(TEST_REF)).toBe(commits.D);
    expect(await local.hasObject(commits.D)).toBe(true);
    expect(await local.hasObject(commits.C)).toBe(true);
    expect(await local.hasObject(commits.A)).toBe(true);
    expect(await local.hasObject(commits.B)).toBe(false);
  });
});
