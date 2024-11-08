import { updateRef } from './updateRef';
import { Repo } from './Repo';
import { ReflogEntry } from './model';
import { dummyPerson } from '../../__testHelpers__/dummyPerson';
import { InMemoryFS } from '@forgsync/simplefs';

describe('updateRef', () => {
  let repo: Repo;
  beforeEach(async () => {
    const fs = new InMemoryFS();
    repo = new Repo(fs);
    await repo.init();
  });

  test('initial commit', async () => {
    expect(await repo.getRef('refs/main')).toBe(undefined);

    await updateRef(repo, 'refs/main', '0000000000000000000000000000000000000001', dummyPerson(), 'test reflog message');
    expect(await repo.getRef('refs/main')).toBe('0000000000000000000000000000000000000001');
    expect(await repo.getReflog('refs/main')).toEqual<ReflogEntry[]>([
      {
        previousCommit: undefined,
        newCommit: '0000000000000000000000000000000000000001',
        person: dummyPerson(),
        description: 'test reflog message',
      },
    ]);
  });

  test('second commit', async () => {
    expect(await repo.getRef('refs/main')).toBe(undefined);

    await updateRef(repo, 'refs/main', '0000000000000000000000000000000000000001', dummyPerson(), 'test reflog message 1');
    await updateRef(repo, 'refs/main', '0000000000000000000000000000000000000002', dummyPerson(), 'test reflog message 2');

    expect(await repo.getRef('refs/main')).toBe('0000000000000000000000000000000000000002');
    expect(await repo.getReflog('refs/main')).toEqual<ReflogEntry[]>([
      {
        previousCommit: undefined,
        newCommit: '0000000000000000000000000000000000000001',
        person: dummyPerson(),
        description: 'test reflog message 1',
      },
      {
        previousCommit: '0000000000000000000000000000000000000001',
        newCommit: '0000000000000000000000000000000000000002',
        person: dummyPerson(),
        description: 'test reflog message 2',
      },
    ]);
  });
});
