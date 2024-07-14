import { InMemoryFS, ListEntry, Path } from '@forgsync/simplefs';
import { Repo } from '../git';
import { GitTreeFS } from './GitTreeFS';
import { ExpandedTree, saveWorkingTree } from '../git/workingTree';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe('GitTreeFS', () => {
  let repo: Repo;
  let workingTree: ExpandedTree;
  beforeEach(async () => {
    const fs = new InMemoryFS();
    repo = new Repo(fs);
    await repo.init();
    workingTree = {
      type: 'tree',
      entries: {
        'a.txt': { type: 'file', body: encoder.encode('a') },
        b: {
          type: 'tree',
          entries: {
            'c.txt': { type: 'file', body: encoder.encode('c') },
            'd.txt': { type: 'file', body: encoder.encode('d') },
            e: {
              type: 'tree',
              entries: {
                'f.txt': { type: 'file', body: encoder.encode('f') },
              },
            },
          },
        },
      },
    };
    await saveWorkingTree(repo, workingTree);
  });

  test.each([['a.txt', 'a'], ['b/c.txt', 'c'], ['b/d.txt', 'd'], ['b/e/f.txt', 'f']])(
    "Read file '%p'", async (path: string, expectedContents: string) => {
      const fs = new GitTreeFS(repo, workingTree);
      const val = decoder.decode(await fs.read(new Path(path)));
      expect(val).toBe(expectedContents);
    });

  test("read on a directory throws EISDIR", async () => {
    const fs = new GitTreeFS(repo, workingTree);
    await expect(() => fs.read(new Path('b'))).rejects.toThrow(/EISDIR/);
  });

  test.each(['a.txt', 'b/c.txt', 'b/d.txt', 'b/e/f.txt'])(
    "fileExists '%p' positive cases", async (path: string) => {
      const fs = new GitTreeFS(repo, workingTree);
      const val = await fs.fileExists(new Path(path));
      expect(val).toBe(true);
    });

  test.each(['f.txt', 'z/a.txt', 'b/e/z/d.txt'])(
    "fileExists '%p' negative cases", async (path: string) => {
      const fs = new GitTreeFS(repo, workingTree);
      const val = await fs.fileExists(new Path(path));
      expect(val).toBe(false);
    });

  test.each(['b', 'b/e'])(
    "fileExists '%p' throw cases", async (path: string) => {
      const fs = new GitTreeFS(repo, workingTree);
      await expect(() => fs.fileExists(new Path(path))).rejects.toThrow(/EISDIR/);
    });

  test.each(['', 'b', 'b/e'])(
    "directoryExists '%p' positive cases", async (path: string) => {
      const fs = new GitTreeFS(repo, workingTree);
      const val = await fs.directoryExists(new Path(path));
      expect(val).toBe(true);
    });

  test.each(['e', 'b/d', 'b/e/z', 'z/b/c/d'])(
    "directoryExists '%p' negative cases", async (path: string) => {
      const fs = new GitTreeFS(repo, workingTree);
      const val = await fs.directoryExists(new Path(path));
      expect(val).toBe(false);
    });

  test.each(['a.txt', 'b/c.txt'])(
    "directoryExists '%p' throw cases", async (path: string) => {
      const fs = new GitTreeFS(repo, workingTree);
      await expect(() => fs.directoryExists(new Path(path))).rejects.toThrow(/ENOTDIR/);
    });

  test("list root", async () => {
    const fs = new GitTreeFS(repo, workingTree);
    const result = await fs.list(new Path(''));
    expect(result).toEqual<ListEntry[]>([
      { kind: 'file', path: new Path('a.txt') },
      { kind: 'dir', path: new Path('b') },
    ]);
  });

  test("list b/e", async () => {
    const fs = new GitTreeFS(repo, workingTree);
    const result = await fs.list(new Path('b/e'));
    expect(result).toEqual<ListEntry[]>([
      { kind: 'file', path: new Path('b/e/f.txt') },
    ]);
  });
});
