import { InMemoryFS, ListEntry, Path } from '@forgsync/simplefs';
import { createCommit, loadCommitObject, loadTreeObject, Repo, TreeBody } from '../git';
import { Hash } from '../git/model';
import { GitTreeFS } from './GitTreeFS';
import { dummyPerson } from '../../__testHelpers__/dummyPerson';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe('GitTreeFS', () => {
  let repo: Repo;
  let commit: Hash;
  let tree: TreeBody;
  beforeEach(async () => {
    const fs = new InMemoryFS();
    repo = new Repo(fs);
    await repo.init();
    commit = await createCommit(repo, {
      files: {
        'a.txt': { body: encoder.encode('a') },
      },
      folders: {
        b: {
          files: {
            'c.txt': { body: encoder.encode('c') },
            'd.txt': { body: encoder.encode('d') },
          },
          folders: {
            e: {
              files: {
                'f.txt': { body: encoder.encode('f') },
              },
            },
          },
        },
      },
    }, [], 'Initial commit', dummyPerson());
    const commitObject = await loadCommitObject(repo, commit);
    if (commitObject === undefined) {
      throw new Error();
    }
    const treeObject = await loadTreeObject(repo, commitObject.body.tree);
    if (treeObject === undefined) {
      throw new Error();
    }
    tree = treeObject.body;
  });

  test.each([['a.txt', 'a'], ['b/c.txt', 'c'], ['b/d.txt', 'd'], ['b/e/f.txt', 'f']])(
    "Read file '%p'", async (path: string, expectedContents: string) => {
      const fs = new GitTreeFS(repo, tree);
      const val = decoder.decode(await fs.read(new Path(path)));
      expect(val).toBe(expectedContents);
    });

  test("read on a directory throws EISDIR", async () => {
    const fs = new GitTreeFS(repo, tree);
    await expect(() => fs.read(new Path('b'))).rejects.toThrow(/EISDIR/);
  });

  test.each(['a.txt', 'b/c.txt', 'b/d.txt', 'b/e/f.txt'])(
    "fileExists '%p' positive cases", async (path: string) => {
      const fs = new GitTreeFS(repo, tree);
      const val = await fs.fileExists(new Path(path));
      expect(val).toBe(true);
    });

  test.each(['f.txt', 'z/a.txt', 'b/e/z/d.txt'])(
    "fileExists '%p' negative cases", async (path: string) => {
      const fs = new GitTreeFS(repo, tree);
      const val = await fs.fileExists(new Path(path));
      expect(val).toBe(false);
    });

  test.each(['b', 'b/e'])(
    "fileExists '%p' throw cases", async (path: string) => {
      const fs = new GitTreeFS(repo, tree);
      await expect(() => fs.fileExists(new Path(path))).rejects.toThrow(/EISDIR/);
    });

  test.each(['', 'b', 'b/e'])(
    "directoryExists '%p' positive cases", async (path: string) => {
      const fs = new GitTreeFS(repo, tree);
      const val = await fs.directoryExists(new Path(path));
      expect(val).toBe(true);
    });

  test.each(['e', 'b/d', 'b/e/z', 'z/b/c/d'])(
    "directoryExists '%p' negative cases", async (path: string) => {
      const fs = new GitTreeFS(repo, tree);
      const val = await fs.directoryExists(new Path(path));
      expect(val).toBe(false);
    });

  test.each(['a.txt', 'b/c.txt'])(
    "directoryExists '%p' throw cases", async (path: string) => {
      const fs = new GitTreeFS(repo, tree);
      await expect(() => fs.directoryExists(new Path(path))).rejects.toThrow(/ENOTDIR/);
    });

  test("list root", async () => {
    const fs = new GitTreeFS(repo, tree);
    const result = await fs.list(new Path(''));
    expect(result).toEqual<ListEntry[]>([
      { kind: 'file', path: new Path('a.txt') },
      { kind: 'dir', path: new Path('b') },
    ]);
  });

  test("list b/e", async () => {
    const fs = new GitTreeFS(repo, tree);
    const result = await fs.list(new Path('b/e'));
    expect(result).toEqual<ListEntry[]>([
      { kind: 'file', path: new Path('b/e/f.txt') },
    ]);
  });
});
