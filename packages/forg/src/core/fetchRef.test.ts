import { Hash, ReflogEntry, Repo, createCommit, updateRef } from '../git';
import { dummyPerson } from '../__testHelpers__/dummyPerson';
import { FetchMode, fetchRef } from './fetchRef';
import { InMemoryFS } from '@forgsync/simplefs';

const MY_CLIENT_UUID = 'client1';
const TEST_REF = `refs/remotes/${MY_CLIENT_UUID}/main`;
describe('fetchRef', () => {
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

  test('Basics', async () => {
    const fs = new InMemoryFS();
    const local = new Repo(fs);
    await local.init();

    for (let i = 0; i < 2; i++) { // Do this twice since it should be idempotent
      const result = await fetchRef(origin, local, TEST_REF, FetchMode.FastEventualConsistent);
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
