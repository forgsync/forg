import { Hash, Repo, createCommit, updateRef } from '../git';
import { dummyPerson } from '../../__testHelpers__/dummyPerson';
import { fetch } from './fetch';
import { InMemoryFS } from '@forgsync/simplefs';

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
      await updateRef(remote, 'refs/remotes/client1/main', hash, dummyPerson(), `Committed: ${name}`);
    }
    commits = {};

    // A -- B
    //  \
    //   C -- D
    //    \
    //     E (refs/remotes/client1/main)
    //
    // Z
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

    await fetch(remote, local, () => true);
    expect(await local.hasObject(commits.E)).toBe(true);
    expect(await local.hasObject(commits.A)).toBe(true);
    expect(await local.hasObject(commits.D)).toBe(false);
    expect(await local.hasObject(commits.B)).toBe(false);
  });
});
