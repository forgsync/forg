import { InMemoryFS } from '@forgsync/simplefs';

import { Repo, createCommit } from '../../git';
import { dummyPerson } from '../../__testHelpers__/dummyPerson';
import { ForgClientHead, listForgHeads } from './listForgHeads';

const encoder = new TextEncoder();

describe('listForgHeads', () => {
  let repo: Repo;
  beforeEach(async () => {
    const fs = new InMemoryFS();
    repo = new Repo(fs);
    await repo.init();
  });

  test('Empty', async () => {
    const result = await listForgHeads(repo, 'main');
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

    const result = await listForgHeads(repo, 'main');
    expect(result.length).toBe(1);

    type DeepPartial<T> = T extends object
      ? {
          [P in keyof T]?: DeepPartial<T[P]>;
        }
      : T;
    expect(result).toMatchObject<DeepPartial<ForgClientHead>[]>([
      {
        clientUuid: 'client1',
        head: {
          hash: commit1,
          commit: {
            body: {
              message: 'Commit 1',
            },
          },
        },
      },
    ]);
  });
});
