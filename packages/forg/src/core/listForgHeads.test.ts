import { FileStorage } from "@flystorage/file-storage";
import { InMemoryStorageAdapter } from '@flystorage/in-memory'

import {
  Repo,
  createCommit,
} from "../git";
import { dummyPerson } from "../__testHelpers__/dummyPerson";
import { ForgClientState, listForgHeads } from './listForgHeads';
import { ForgClientInfo } from "./model";

const encoder = new TextEncoder();

describe('listForgHeads', () => {
  const thisClient: ForgClientInfo = { uuid: 'client1' };
  let repo: Repo;
  beforeEach(async () => {
    const fs = new FileStorage(new InMemoryStorageAdapter());
    repo = new Repo(fs);
    await repo.init();
  });

  test('Empty', async () => {
    const result = await listForgHeads(repo, thisClient, 'main');
    expect(result.length).toBe(0);
  });

  test('One', async () => {
    const commit1 = await createCommit(
      repo,
      {
        files: {
          a: { isExecutable: false, body: encoder.encode('a') },
        },
      },
      [],
      'Commit 1',
      dummyPerson()
    );
    await repo.setRef('refs/remotes/client1/main', commit1); // Should be skipped because this matches ourselves...
    await repo.setRef('refs/remotes/client2/main', commit1);

    const result = await listForgHeads(repo, thisClient, 'main');
    expect(result.length).toBe(1);

    type DeepPartial<T> = T extends object ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    } : T;
    expect(result).toMatchObject<DeepPartial<ForgClientState>[]>([
      {
        clientUuid: 'client2',
        commit: {
          hash: commit1,
          commit: {
            body: {
              message: 'Commit 1',
            },
          },
        },
      }
    ]);
  });
});
