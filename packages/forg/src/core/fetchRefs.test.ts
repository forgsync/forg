import { Hash, InitMode, Repo, createCommit, updateRef } from '../git';
import { dummyPerson } from '../__testHelpers__/dummyPerson';
import { fetchRefs } from './fetchRefs';
import { InMemoryFS } from '@forgsync/simplefs';

const MY_CLIENT_UUID = 'client1';
const OTHER_CLIENT_UUID = 'clientOther';
const TEST_REF = `refs/remotes/${MY_CLIENT_UUID}/main`;
describe('fetchRefs', () => {
  let origin: Repo;
  let commits: { [key: string]: Hash };
  beforeEach(async () => {
    const fs = new InMemoryFS();
    origin = new Repo(fs);
    await origin.init(InitMode.CreateIfNotExists);

    async function trackCommit(name: string, parents: Hash[]) {
      const hash = await createCommit(origin, { type: 'tree', entries: {} }, parents, name, dummyPerson());
      commits[name] = hash;
      await updateRef(origin, TEST_REF, hash, dummyPerson(), `commit: ${name}`);
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

  test('Fetches remote branches other than our own remote', async () => {
    const fs = new InMemoryFS();
    const local = new Repo(fs);
    await local.init(InitMode.CreateIfNotExists);

    await fetchRefs(origin, local, { uuid: OTHER_CLIENT_UUID });
    expect(await local.getRef(TEST_REF)).toBe(commits.E);
    expect(await local.hasObject(commits.E)).toBe(true);
    expect(await local.hasObject(commits.C)).toBe(true);
    expect(await local.hasObject(commits.A)).toBe(true);
    expect(await local.hasObject(commits.D)).toBe(false);
    expect(await local.hasObject(commits.B)).toBe(false);
  });

  test('Skips our own remote', async () => {
    const fs = new InMemoryFS();
    const local = new Repo(fs);
    await local.init(InitMode.CreateIfNotExists);

    await fetchRefs(origin, local, { uuid: MY_CLIENT_UUID });
    expect(await local.getRef(TEST_REF)).toBeUndefined();
  });

  test('Uses reflog if top commit is malformed', async () => {
    const fs = new InMemoryFS();
    const local = new Repo(fs);
    await local.init(InitMode.CreateIfNotExists);

    await origin.deleteObject(commits.E); // ref still points here, but we delete the object (e.g. simulate that this wasn't uploaded yet to the remote)

    await fetchRefs(origin, local, { uuid: OTHER_CLIENT_UUID }); // would attempt to sync commit E, which would fail, and then falls back to reflog -- the next entry would be commit D
    expect(await local.getRef(TEST_REF)).toBe(commits.D);
    expect(await local.hasObject(commits.D)).toBe(true);
    expect(await local.hasObject(commits.C)).toBe(true);
    expect(await local.hasObject(commits.A)).toBe(true);
    expect(await local.hasObject(commits.B)).toBe(false);
  });
});
