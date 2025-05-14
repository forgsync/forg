import { createCommit } from './createCommit';
import { InitMode, Repo } from './Repo';
import { Mode } from './model';
import { CommitBody, loadBlobObject, loadCommitObject, loadTreeObject, TreeBody } from './objects';
import { dummyPerson } from '../../__testHelpers__/dummyPerson';
import { InMemoryFS } from '@forgsync/simplefs';
import { WorkingTreeEntry } from './workingTree';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe('createCommit', () => {
  let repo: Repo;
  beforeEach(async () => {
    const fs = new InMemoryFS();
    repo = new Repo(fs);
    await repo.init(InitMode.CreateIfNotExists);
  });

  test('initial commit', async () => {
    const hash = await createCommit(repo, { type: 'tree', entries: new Map() }, [], 'Initial commit', dummyPerson());
    expect(hash).toBe('eaef5b6f452335fad4dd280a113d81e82a3acaca');

    const commit = await loadCommitObject(repo, hash);
    expect(commit.body).toEqual<CommitBody>({
      tree: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
      parents: [],
      author: dummyPerson(),
      committer: dummyPerson(),
      message: 'Initial commit',
    });
  });

  test('parented commit with tree', async () => {
    const hash = await createCommit(
      repo,
      {
        type: 'tree',
        entries: new Map<string, WorkingTreeEntry>([
          ['a.txt', {
            type: 'file',
            body: encoder.encode('a'),
          }],
        ]),
      },
      ['eaef5b6f452335fad4dd280a113d81e82a3acaca'],
      'Added a.txt',
      dummyPerson(),
    );
    expect(hash).toBe('9254379c365d23429f0fff266834bdc853c35fe1');

    const commit = await loadCommitObject(repo, hash);
    expect(commit.body).toEqual<CommitBody>({
      tree: '1a602d9bd07ce5272ddaa64e21da12dbca2b8c9f',
      parents: ['eaef5b6f452335fad4dd280a113d81e82a3acaca'],
      author: dummyPerson(),
      committer: dummyPerson(),
      message: 'Added a.txt',
    });

    const rootTreeObject = await loadTreeObject(repo, '1a602d9bd07ce5272ddaa64e21da12dbca2b8c9f');
    expect(rootTreeObject.body).toEqual<TreeBody>({
      'a.txt': {
        mode: Mode.blob,
        hash: '2e65efe2a145dda7ee51d1741299f848e5bf752e',
      },
    });

    const aBlobObject = await loadBlobObject(repo, '2e65efe2a145dda7ee51d1741299f848e5bf752e');
    expect(decoder.decode(aBlobObject.body)).toBe('a');
  });
});
