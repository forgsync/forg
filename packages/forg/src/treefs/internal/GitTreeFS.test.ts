import { InMemoryFS, ListEntry, Path } from '@forgsync/simplefs';
import { InitMode, Repo } from '../../git';
import { GitTreeFS } from './GitTreeFS';
import { ExpandedTree, saveWorkingTree } from '../../git';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe('GitTreeFS', () => {
  let repo: Repo;
  let workingTree: ExpandedTree;
  let fs: GitTreeFS;
  beforeEach(async () => {
    const repofs = new InMemoryFS();
    repo = new Repo(repofs);
    await repo.init(InitMode.CreateIfNotExists);
    workingTree = {
      type: 'tree',
      entries: {
        'a.txt': { type: 'file', body: encoder.encode('a') },
        'bad.txt': { type: 'file', hash: '0000000000000000000000000000000000000001' },
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
            bad: { type: 'tree', hash: '0000000000000000000000000000000000000002' },
          },
        },
      },
    };
    await saveWorkingTree(repo, workingTree);
    fs = GitTreeFS.fromWorkingTree(repo, workingTree);
  });

  test.each([['a.txt', 'a'], ['b/c.txt', 'c'], ['b/d.txt', 'd'], ['b/e/f.txt', 'f']])(
    "Read file '%p'", async (path: string, expectedContents: string) => {
      const val = decoder.decode(await fs.read(new Path(path)));
      expect(val).toBe(expectedContents);
    });

  test("read on a directory throws EISDIR", async () => {
    await expect(() => fs.read(new Path('b'))).rejects.toThrow(/EISDIR/);
  });

  test("read where blob is missing throws EIO", async () => {
    await expect(() => fs.read(new Path('bad.txt'))).rejects.toThrow(/EIO/);
  });

  test("read where some parent tree is missing throws EIO", async () => {
    await expect(() => fs.read(new Path('b/bad/whatever'))).rejects.toThrow(/EIO/);
  });

  test.each(['a.txt', 'b/c.txt', 'b/d.txt', 'b/e/f.txt', 'bad.txt'])(
    "fileExists '%p' positive cases", async (path: string) => {
      const val = await fs.fileExists(new Path(path));
      expect(val).toBe(true);
    });

  test.each(['f.txt', 'z/a.txt', 'b/e/z/d.txt'])(
    "fileExists '%p' negative cases", async (path: string) => {
      const val = await fs.fileExists(new Path(path));
      expect(val).toBe(false);
    });

  test.each(['b', 'b/e'])(
    "fileExists '%p' throw cases", async (path: string) => {
      await expect(() => fs.fileExists(new Path(path))).rejects.toThrow(/EISDIR/);
    });

  test("fileExists where some parent tree is missing throws EIO", async () => {
    await expect(() => fs.fileExists(new Path('b/bad/whatever'))).rejects.toThrow(/EIO.*corresponding to working tree path 'b\/bad'/);
  });

  test.each(['', 'b', 'b/e', 'b/bad'])(
    "directoryExists '%p' positive cases", async (path: string) => {
      const val = await fs.directoryExists(new Path(path));
      expect(val).toBe(true);
    });

  test.each(['e', 'b/d', 'b/e/z', 'z/b/c/d'])(
    "directoryExists '%p' negative cases", async (path: string) => {
      const val = await fs.directoryExists(new Path(path));
      expect(val).toBe(false);
    });

  test.each(['a.txt', 'b/c.txt'])(
    "directoryExists '%p' throw cases", async (path: string) => {
      await expect(() => fs.directoryExists(new Path(path))).rejects.toThrow(/ENOTDIR/);
    });

  test("directoryExists where some parent tree is missing throws EIO", async () => {
    await expect(() => fs.directoryExists(new Path('b/bad/whatever'))).rejects.toThrow(/EIO.*corresponding to working tree path 'b\/bad'/);
  });

  test("list root", async () => {
    const result = await fs.list(new Path(''));
    expect(result).toEqual<ListEntry[]>([
      { kind: 'file', path: new Path('a.txt') },
      { kind: 'file', path: new Path('bad.txt') },
      { kind: 'dir', path: new Path('b') },
    ]);
  });

  test("list b/e", async () => {
    const result = await fs.list(new Path('b/e'));
    expect(result).toEqual<ListEntry[]>([
      { kind: 'file', path: new Path('b/e/f.txt') },
    ]);
  });

  test("list where tree is missing throws EIO", async () => {
    await expect(() => fs.directoryExists(new Path('b/bad/whatever'))).rejects.toThrow(/EIO/);
  });

  test("list where some parent tree is missing throws EIO", async () => {
    await expect(() => fs.directoryExists(new Path('b/bad/whatever'))).rejects.toThrow(/EIO/);
  });

  test.each(['new.txt', 'b/new.txt', 'b/e/new.txt', 'new/new.txt', 'b/new/new.txt'])
    ("write creates new file '%p'", async (path: string) => {
      await fs.write(new Path(path), encoder.encode('new file'));
      const result = decoder.decode(await fs.read(new Path(path)));
      expect(result).toBe('new file');
    });

  test("write where some parent tree is missing throws EIO", async () => {
    await expect(() => fs.write(new Path('b/bad/whatever'), new Uint8Array())).rejects.toThrow(/EIO/);
  });

  test.each(['new', 'b/new', 'b/e/new', 'new/new/new'])
    ("createDirectory creates entire path hierarchy '%p'", async (path: string) => {
      await fs.createDirectory(new Path(path));
      expect(await fs.directoryExists(new Path(path))).toBe(true);
    });

  test.each(['a.txt', 'b/c.txt'])
    ("createDirectory on a path that is a file '%p'", async (path: string) => {
      await expect(() => fs.createDirectory(new Path(path))).rejects.toThrow(/EEXIST/);
    });

  test.each(['a.txt/new', 'b/c.txt/new/new'])
    ("createDirectory on a path comprised of non-folders '%p'", async (path: string) => {
      await expect(() => fs.createDirectory(new Path(path))).rejects.toThrow(/ENOTDIR/);
    });

  test("createDirectory where some parent tree is missing throws EIO", async () => {
    await expect(() => fs.createDirectory(new Path('b/bad/whatever'))).rejects.toThrow(/EIO/);
  });

  test("deleteDirectory", async () => {
    expect(await fs.directoryExists(new Path('b/e'))).toBe(true);
    expect(await fs.fileExists(new Path('b/e/f.txt'))).toBe(true);

    await fs.deleteDirectory(new Path('b/e'));

    expect(await fs.directoryExists(new Path('b/e'))).toBe(false);
    expect(await fs.fileExists(new Path('b/e/f.txt'))).toBe(false);
  });

  test.each(['z', 'b/z'])("deleteDirectory throws if not exists: '%p'", async (path: string) => {
    await expect(() => fs.deleteDirectory(new Path(path))).rejects.toThrow(/ENOENT/);
  });

  test.each(['a.txt', 'b/c.txt'])("deleteDirectory throws if not a directory: '%p'", async (path: string) => {
    await expect(() => fs.deleteDirectory(new Path(path))).rejects.toThrow(/ENOTDIR/);
  });

  test("deleteDirectory where some parent tree is missing throws EIO", async () => {
    await expect(() => fs.deleteDirectory(new Path('b/bad/whatever'))).rejects.toThrow(/EIO/);
  });

  test("deleteFile", async () => {
    expect(await fs.directoryExists(new Path('b/e'))).toBe(true);
    expect(await fs.fileExists(new Path('b/e/f.txt'))).toBe(true);

    await fs.deleteFile(new Path('b/e/f.txt'));

    expect(await fs.directoryExists(new Path('b/e'))).toBe(true);
    expect(await fs.fileExists(new Path('b/e/f.txt'))).toBe(false);
  });

  test.each(['z', 'b/z'])("deleteFile throws if not exists: '%p'", async (path: string) => {
    await expect(() => fs.deleteFile(new Path(path))).rejects.toThrow(/ENOENT/);
  });

  test.each(['b', 'b/e'])("deleteFile throws if not a file: '%p'", async (path: string) => {
    await expect(() => fs.deleteFile(new Path(path))).rejects.toThrow(/EISDIR/);
  });

  test("deleteFile where some parent tree is missing throws EIO", async () => {
    await expect(() => fs.deleteFile(new Path('b/bad/whatever'))).rejects.toThrow(/EIO/);
  });
});
