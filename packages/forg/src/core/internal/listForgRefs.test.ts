import { InMemoryFS } from '@forgsync/simplefs';

import { InitMode, Repo, createCommit } from '../../git';
import { dummyPerson } from '../../__testHelpers__/dummyPerson';
import { ForgRef, listForgRefs } from './listForgRefs';

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

    type DeepPartial<T> = T extends object
      ? {
        [P in keyof T]?: DeepPartial<T[P]>;
      }
      : T;
    expect(result).toMatchObject<DeepPartial<ForgRef>[]>([
      {
        clientUuid: 'client1',
        commitId: commit1,
      },
    ]);
  });
});
