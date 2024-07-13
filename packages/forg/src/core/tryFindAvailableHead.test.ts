import { Repo, createCommit, updateRef } from '../git';
import { dummyPerson } from '../__testHelpers__/dummyPerson';
import { tryFindAvailableHead } from './tryFindAvailableHead';
import { InMemoryFS } from '@forgsync/simplefs';

const encoder = new TextEncoder();

describe('tryFindAvailableHead', () => {
  let repo: Repo;
  beforeEach(async () => {
    const fs = new InMemoryFS();
    repo = new Repo(fs);
    await repo.init();
  });

  test('If ref does not exist', async () => {
    const result = await tryFindAvailableHead(repo, 'refs/remotes/client1/main');
    expect(result).toBe(undefined);
  });

  test('Uses current head if it is viable', async () => {
    const commitId = await createCommit(
      repo,
      {
        files: {
          a: { isExecutable: false, body: encoder.encode('a') },
        },
      },
      [],
      'Commit 1',
      dummyPerson(),
    );

    await updateRef(
      repo,
      'refs/remotes/client1/main',
      commitId,
      dummyPerson(),
      'commit (initial): Commit 1',
    );

    const result = await tryFindAvailableHead(repo, 'refs/remotes/client1/main');
    expect(result?.hash).toBe(commitId);
    expect(result?.commit.body.message).toBe('Commit 1');
  });

  test('Uses parent if head is not viable but parent is', async () => {
    const commit1 = await createCommit(
      repo,
      {
        files: {
          a: { isExecutable: false, body: encoder.encode('a') },
        },
      },
      [],
      'Commit 1',
      dummyPerson(),
    );
    const commit2 = await createCommit(
      repo,
      {
        files: {
          a: { isExecutable: false, hash: '0000000000000000000000000000000000000001' }, // Not viable, this hash doesn't exist in the repo
        },
      },
      [commit1],
      'Commit 2',
      dummyPerson(),
    );
    const commit3 = await createCommit(
      repo,
      {
        files: {
          a: { isExecutable: false, hash: '0000000000000000000000000000000000000002' }, // Not viable, this hash doesn't exist in the repo
        },
      },
      [commit2],
      'Commit 3',
      dummyPerson(),
    );

    await repo.setRef('refs/remotes/client1/main', commit3);

    const result = await tryFindAvailableHead(repo, 'refs/remotes/client1/main');
    expect(result?.hash).toBe(commit1);
    expect(result?.commit.body.message).toBe('Commit 1');
  });

  test('Uses reflog if ref is bad', async () => {
    const commit1 = await createCommit(
      repo,
      {
        files: {
          a: { isExecutable: false, hash: '0000000000000000000000000000000000000001' },
        },
      },
      [],
      'Commit 1',
      dummyPerson(),
    );
    await updateRef(
      repo,
      'refs/remotes/client1/main',
      commit1,
      dummyPerson(),
      'commit (initial): Commit 1',
    );

    const commit2 = await createCommit(
      repo,
      {
        files: {
          a: { isExecutable: false, body: encoder.encode('a') },
        },
      },
      [commit1],
      'Commit 2',
      dummyPerson(),
    );
    await updateRef(repo, 'refs/remotes/client1/main', commit2, dummyPerson(), 'commit: Commit 2');

    const commit3 = await createCommit(
      repo,
      {
        files: {
          a: { isExecutable: false, hash: '0000000000000000000000000000000000000001' }, // Not viable, this hash doesn't exist in the repo
        },
      },
      [commit2],
      'Commit 3',
      dummyPerson(),
    );
    await updateRef(repo, 'refs/remotes/client1/main', commit3, dummyPerson(), 'commit: Commit 3');

    await repo.setRef('refs/remotes/client1/main', '000000000000000000000000000000000000000f'); // Set the ref to some unknown commit id -- simulates that perhaps the ref was just updated but the corresponding commit object hasn't been uploaded yet.

    const result = await tryFindAvailableHead(repo, 'refs/remotes/client1/main');
    expect(result?.hash).toBe(commit2);
    expect(result?.commit.body.message).toBe('Commit 2');
  });
});
