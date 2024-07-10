import { FileStorage } from '@flystorage/file-storage'
import { InMemoryStorageAdapter } from '@flystorage/in-memory'

import { createCommit, updateRef, CommitBody, loadObject, Repo, TreeBody } from "../git"
import { Mode, Person, ReflogEntry } from '../git/model';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe("Repo basics", () => {
  let repo: Repo;
  beforeEach(async () => {
    const fs = new FileStorage(new InMemoryStorageAdapter());
    repo = new Repo(fs);
    await repo.init();
  });

  test('just init', () => { });

  test('trivial commit', async () => {
    const hash = await createCommit(
      repo,
      {},
      [],
      "Initial commit",
      dummyPerson());
    expect(hash).toBe('eaef5b6f452335fad4dd280a113d81e82a3acaca');

    await updateRef(repo, "refs/main", hash, dummyPerson(), "commit (initial): Initial commit");
    expect(await repo.getRef("refs/main")).toBe(hash);

    const reflog = await repo.getReflog("refs/main");
    expect(reflog).toEqual<ReflogEntry[]>([{
      previousCommit: '0000000000000000000000000000000000000000',
      newCommit: hash,
      person: dummyPerson(),
      description: 'commit (initial): Initial commit',
    }]);

    const commitObject = await loadObject(repo, hash);
    if (commitObject === undefined || commitObject.type !== "commit") {
      fail(`Not a commit: ${hash}`);
    }
    expect(commitObject.body).toEqual<CommitBody>({
      tree: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
      parents: [],
      author: dummyPerson(),
      committer: dummyPerson(),
      message: 'Initial commit',
    });
  });

  test('commit with non-empty tree', async () => {
    const hash = await createCommit(
      repo,
      {
        files: {
          "a.txt": {
            isExecutable: false,
            body: encoder.encode("aa"),
          },
        },
        folders: {
          "b": {
            files: {
              "c.txt": {
                isExecutable: false,
                body: encoder.encode("cc"),
              }
            }
          }
        },
      },
      [],
      "Initial commit",
      dummyPerson());
    expect(hash).toBe('2f5877487a12348f8de42fc64e9c46bd5d22a651');

    const commitObject = await loadObject(repo, hash);
    if (commitObject === undefined || commitObject.type !== "commit") {
      fail(`Not a commit: ${hash}`);
    }

    const rootTreeObject = await loadObject(repo, commitObject.body.tree);
    if (rootTreeObject === undefined || rootTreeObject.type !== "tree") {
      fail(`Not a tree: ${commitObject.body.tree}`);
    }

    expect(rootTreeObject.body).toEqual<TreeBody>({
      'a.txt': {
        mode: Mode.blob,
        hash: '7ec9a4b774e2472d8e38bc18a3aa1912bacf483e',
      },
      'b': {
        mode: Mode.tree,
        hash: 'bc3aa3eb92286b2ddaab0bef7564f25098f8fbdc',
      },
    });

    const aBlobObject = await loadObject(repo, '7ec9a4b774e2472d8e38bc18a3aa1912bacf483e');
    if (aBlobObject === undefined || aBlobObject.type !== 'blob') {
      fail('Not a blob');
    }
    expect(decoder.decode(aBlobObject.body)).toBe('aa');

    const bTreeObject = await loadObject(repo, rootTreeObject.body['b'].hash);
    if (bTreeObject === undefined || bTreeObject.type !== "tree") {
      fail(`Not a tree: ${rootTreeObject.body['b'].hash}`);
    }

    expect(bTreeObject.body).toEqual<TreeBody>({
      'c.txt': {
        mode: Mode.blob,
        hash: '2652f5f42c003f125212dd61f95a3a8a37cb45d5',
      },
    });

    const cBlobObject = await loadObject(repo, '2652f5f42c003f125212dd61f95a3a8a37cb45d5');
    if (cBlobObject === undefined || cBlobObject.type !== 'blob') {
      fail('Not a blob');
    }
    expect(decoder.decode(cBlobObject.body)).toBe('cc');
  });

  test('two commits', async () => {
    const hash1 = await createCommit(
      repo,
      {},
      [],
      "Initial commit",
      dummyPerson());
    expect(hash1).toBe('eaef5b6f452335fad4dd280a113d81e82a3acaca');

    const hash2 = await createCommit(
      repo,
      {
        files: {
          "a.txt": {
            isExecutable: false,
            body: encoder.encode("a"),
          },
        },
      },
      [hash1],
      "Added a.txt",
      dummyPerson());
    expect(hash2).toBe('9254379c365d23429f0fff266834bdc853c35fe1');

    const commitObject = await loadObject(repo, hash2);
    if (commitObject === undefined || commitObject.type !== "commit") {
      throw new Error("not a commit!");
    }
    expect(commitObject.body).toEqual<CommitBody>({
      tree: '1a602d9bd07ce5272ddaa64e21da12dbca2b8c9f',
      parents: [hash1],
      author: dummyPerson(),
      committer: dummyPerson(),
      message: 'Added a.txt',
    });
  });

  test('listRefs', async () => {
    await repo.setRef('refs/heads/main', '0000000000000000000000000000000000000001');
    const refs = await repo.listRefs();
    expect(refs).toEqual(['refs/heads/main']);
  });
});

function dummyPerson(): Person {
  return {
    name: "Test Name",
    email: "test@example.com",
    date: {
      seconds: 2272247100,
      offset: 180,
    },
  }
};
