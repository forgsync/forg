import { Hash, ReflogEntry, Repo, createCommit, updateRef } from '../db';
import { dummyPerson } from '../../__testHelpers__/dummyPerson';
import { forcePushRef, PushStrategy } from './forcePushRef';
import { InMemoryFS } from '@forgsync/simplefs';

const TEST_REF = 'refs/remotes/client1/main';
describe('forcePushRef', () => {
  let local: Repo;
  let commits: { [key: string]: Hash };

  async function commit(name: string, parents: Hash[], ref?: string) {
    const hash = await createCommit(local, { type: 'tree', entries: {} }, parents, name, dummyPerson());
    commits[name] = hash;
    if (ref !== undefined) {
      await updateRef(local, ref, hash, dummyPerson(), `Committed: ${name}`);
    }
  }

  beforeEach(async () => {
    const fs = new InMemoryFS();
    local = new Repo(fs);
    await local.init();
    commits = {};

    // A -- B
    //  \
    //   C -- D
    //    \
    //     E (refs/remotes/client1/main)
    //
    await commit('A', [], TEST_REF);
    await commit('B', [commits.A], TEST_REF);
    await commit('C', [commits.A], TEST_REF);
    await commit('D', [commits.C], TEST_REF);
    await commit('E', [commits.C], TEST_REF);
  });

  test('Basics', async () => {
    const fs = new InMemoryFS();
    const remote = new Repo(fs);
    await remote.init();

    for (let i = 0; i < 2; i++) { // Do this twice since it should be idempotent
      await forcePushRef(local, remote, TEST_REF, PushStrategy.Fastest);
      expect(await remote.getRef(TEST_REF)).toBe(commits.E);
      expect(await remote.hasObject(commits.E)).toBe(true);
      expect(await remote.hasObject(commits.C)).toBe(true);
      expect(await remote.hasObject(commits.A)).toBe(true);
      expect(await remote.hasObject(commits.D)).toBe(false);
      expect(await remote.hasObject(commits.B)).toBe(false);

      const remoteReflog = await remote.getReflog(TEST_REF);
      expect(remoteReflog).toEqual<ReflogEntry[]>([
        {
          previousCommit: undefined,
          newCommit: commits.E,
          person: dummyPerson(),
          description: 'push (force): E',
        },
      ]);
    }

    // A -- B
    //  \
    //   C -- D -- F
    //    \         \
    //     E -------- G (refs/remotes/client1/main)
    //
    await commit('F', [commits.D]);
    await commit('G', [commits.D, commits.F], TEST_REF);

    await forcePushRef(local, remote, TEST_REF, PushStrategy.Fastest); // Now D, F and G should appear in the remote
    expect(await remote.hasObject(commits.D)).toBe(true);
    expect(await remote.hasObject(commits.F)).toBe(true);
    expect(await remote.hasObject(commits.G)).toBe(true);
    expect(await remote.hasObject(commits.B)).toBe(false);

    const remoteReflog2 = await remote.getReflog(TEST_REF);
    expect(remoteReflog2).toEqual<ReflogEntry[]>([
      {
        previousCommit: undefined,
        newCommit: commits.E,
        person: dummyPerson(),
        description: 'push (force): E',
      },
      {
        previousCommit: commits.E,
        newCommit: commits.G,
        person: dummyPerson(),
        description: 'push (force): G',
      },
    ]);
  });
});
