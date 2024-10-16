import { Hash, ReflogEntry, Repo, createCommit, updateRef } from '../git';
import { dummyPerson } from '../__testHelpers__/dummyPerson';
import { FetchConsistency, fetchRef, fetchRefs } from './fetch';
import { InMemoryFS } from '@forgsync/simplefs';

const MY_CLIENT_UUID = 'client1';
const OTHER_CLIENT_UUID = 'clientOther';
const TEST_REF = `refs/remotes/${MY_CLIENT_UUID}/main`;
describe('fetch', () => {
  let origin: Repo;
  let commits: { [key: string]: Hash };
  beforeEach(async () => {
    const fs = new InMemoryFS();
    origin = new Repo(fs);
    await origin.init();

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

  describe('fetchRef', () => {
    test('Basics', async () => {
      const fs = new InMemoryFS();
      const local = new Repo(fs);
      await local.init();

      for (let i = 0; i < 2; i++) { // Do this twice since it should be idempotent
        const result = await fetchRef(origin, local, TEST_REF, FetchConsistency.Balanced);
        expect(result).toBe(commits.E);
        expect(await local.getReflog(TEST_REF)).toEqual<ReflogEntry[]>([
          {
            previousCommit: undefined,
            newCommit: commits.E,
            description: 'fetch: E',
            person: dummyPerson(),
          },
        ]);
      }
    });
  });

  describe('fetchRefs', () => {
    test('Fetches remote branches other than our own remote', async () => {
      const fs = new InMemoryFS();
      const local = new Repo(fs);
      await local.init();

      await fetchRefs(origin, local, { uuid: OTHER_CLIENT_UUID }, FetchConsistency.Balanced);
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
      await local.init();

      await fetchRefs(origin, local, { uuid: MY_CLIENT_UUID }, FetchConsistency.Balanced);
      expect(await local.getRef(TEST_REF)).toBeUndefined();
    });

    test('Uses reflog if top commit is malformed', async () => {
      const fs = new InMemoryFS();
      const local = new Repo(fs);
      await local.init();

      await origin.deleteObject(commits.E); // ref still points here, but we delete the object (e.g. simulate that this wasn't uploaded yet to the remote)

      await fetchRefs(origin, local, { uuid: OTHER_CLIENT_UUID }, FetchConsistency.Balanced); // would attempt to sync commit E, which would fail, and then falls back to reflog -- the next entry would be commit D
      expect(await local.getRef(TEST_REF)).toBe(commits.D);
      expect(await local.hasObject(commits.D)).toBe(true);
      expect(await local.hasObject(commits.C)).toBe(true);
      expect(await local.hasObject(commits.A)).toBe(true);
      expect(await local.hasObject(commits.B)).toBe(false);
    });
  });
});
