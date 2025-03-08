import { InMemoryFS } from '@forgsync/simplefs';

import { InitMode, Repo, createCommit } from '../../git';
import { dummyPerson } from '../../__testHelpers__/dummyPerson';
import { ResolvedForgRef, listForgRefs } from './listForgRefs';

const encoder = new TextEncoder();

describe('listForgRefs', () => {
  let repo: Repo;
  beforeEach(async () => {
    const fs = new InMemoryFS();
    repo = new Repo(fs);
    await repo.init(InitMode.CreateIfNotExists);
  });

  test('Empty', async () => {
    const result = await listForgRefs(repo, 'main', false);
    expect(result.length).toBe(0);
  });

  test('One', async () => {
    const commit1 = await createCommit(
      repo,
      {
        type: 'tree',
        entries: {
          a: { type: 'file', body: encoder.encode('a') },
        },
      },
      [],
      'Commit 1',
      dummyPerson(),
    );
    await repo.setRef('refs/remotes/client1/main', commit1);

    const result = await listForgRefs(repo, 'main', false);
    expect(result.length).toBe(1);
    expect(result).toMatchObject<ResolvedForgRef[]>([
      {
        ref: 'refs/remotes/client1/main',
        clientUuid: 'client1',
        branchName: 'main',
        commitId: commit1,
      },
    ]);
  });
});
