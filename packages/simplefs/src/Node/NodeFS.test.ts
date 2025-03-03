import fs from 'fs/promises';
import { NodeFS } from './NodeFS';
import { Path } from '../model/Path';
import { ListEntry } from '../model/ISimpleFS';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const BASE_PATH = './.test_tmp_out';
describe('NodeFS', () => {
  let sut: NodeFS;

  beforeAll(async () => {
    await fs.rm(BASE_PATH, { recursive: true, force: true });
  });
  afterAll(async () => {
    await fs.rm(BASE_PATH, { recursive: true, force: true });
  });

  beforeEach(async () => {
    const basePath = `${BASE_PATH}/tst-${expect.getState().currentTestName}-${(Math.random() * 1000000000) | 0}`;
    await fs.mkdir(basePath, { recursive: true });
    sut = new NodeFS(basePath);
  });

  test('fileExists_false', async () => {
    const path = new Path('a.txt');
    expect(await sut.fileExists(path)).toBe(false);
  });
  test('fileExists_true', async () => {
    const path = new Path('a.txt');
    await sut.write(path, new Uint8Array());
    expect(await sut.fileExists(path)).toBe(true);
  });
  test('fileExists_dir', async () => {
    const path = new Path('dir');
    await sut.createDirectory(path);
    expect(await sut.fileExists(path)).toBe(false);
  });

  test('directoryExists_false', async () => {
    const path = new Path('dir');
    expect(await sut.directoryExists(path)).toBe(false);
  });
  test('directoryExists_true', async () => {
    const path = new Path('dir');
    await sut.createDirectory(path);
    expect(await sut.directoryExists(path)).toBe(true);
  });
  test('directoryExists_dir', async () => {
    const path = new Path('dir');
    await sut.write(path, new Uint8Array());
    expect(await sut.directoryExists(path)).toBe(false);
  });

  test('read_write', async () => {
    const path = new Path('a.txt');
    await sut.write(path, encoder.encode('some \0contents'));
    const actual = await sut.read(path);
    expect(decoder.decode(actual)).toBe('some \0contents');
  });
  test('read_nonExistent', async () => {
    const path = new Path('aaa.txt');
    await expect(() => sut.read(path)).rejects.toThrow(/ENOENT/);
  });
  test('read_dir', async () => {
    const path = new Path('dir');
    await sut.createDirectory(path);
    await expect(() => sut.read(path)).rejects.toThrow(/EISDIR/);
  });

  test('deleteFile_good', async () => {
    const path = new Path('a.txt');
    await sut.write(path, new Uint8Array());
    expect(await sut.fileExists(path)).toBe(true);
    await sut.deleteFile(path);
    expect(await sut.fileExists(path)).toBe(false);
  });
  test('deleteFile_dir', async () => {
    const path = new Path('dir');
    await sut.createDirectory(path);
    await expect(() => sut.deleteFile(path)).rejects.toThrow(/EISDIR|EPERM/);
    expect(await sut.directoryExists(path)).toBe(true);
  });

  test('deleteDirectory_good', async () => {
    const path = new Path('dir');
    await sut.createDirectory(path);
    expect(await sut.directoryExists(path)).toBe(true);
    await sut.deleteDirectory(path);
    expect(await sut.directoryExists(path)).toBe(false);
  });
  test('deleteDirectory_recursive', async () => {
    const top = new Path('dir');
    const nested = Path.join(top, new Path('nested'));

    await sut.createDirectory(nested);
    expect(await sut.directoryExists(top)).toBe(true);
    expect(await sut.directoryExists(nested)).toBe(true);

    await sut.deleteDirectory(top);
    expect(await sut.directoryExists(top)).toBe(false);
    expect(await sut.directoryExists(nested)).toBe(false);
  });
  test('deleteDirectory_file', async () => {
    const path = new Path('a.txt');
    await sut.write(path, new Uint8Array());

    await expect(() => sut.deleteDirectory(path)).rejects.toThrow(/ENOTDIR/);
    expect(await sut.fileExists(path)).toBe(true);
  });

  test('list_nonExistent', async () => {
    const path = new Path('dir');
    await expect(() => sut.list(path)).rejects.toThrow(/ENOENT/);
  });
  test('list_emptyRoot', async () => {
    const path = new Path('');
    expect(await sut.list(path)).toEqual([]);
  });
  test('list_empty', async () => {
    const path = new Path('dir');
    await sut.createDirectory(path);
    expect(await sut.list(path)).toEqual([]);
  });
  test('list_onefile', async () => {
    const path = new Path('dir');

    await sut.write(Path.join(path, new Path('a.txt')), new Uint8Array());
    expect(await sut.list(path)).toEqual<ListEntry[]>([
      { path: new Path('dir/a.txt'), kind: 'file' },
    ]);
  });
  test('list_onefileRoot', async () => {
    const path = new Path('');

    await sut.write(new Path('a.txt'), new Uint8Array());
    expect(await sut.list(path)).toEqual<ListEntry[]>([
      { path: new Path('a.txt'), kind: 'file' },
    ]);
  });
  test('list_onedir', async () => {
    const path = new Path('dir');

    await sut.createDirectory(Path.join(path, new Path('nested')));
    expect(await sut.list(path)).toEqual<ListEntry[]>([
      { path: new Path('dir/nested'), kind: 'dir' },
    ]);
  });
  test('list_fileanddir', async () => {
    const path = new Path('dir');

    await sut.write(Path.join(path, new Path('a.txt')), new Uint8Array());
    await sut.createDirectory(Path.join(path, new Path('nested')));
    expect(await sut.list(path)).toEqual<ListEntry[]>([
      { path: new Path('dir/a.txt'), kind: 'file' },
      { path: new Path('dir/nested'), kind: 'dir' },
    ]);
  });
  test('list_notRecursive', async () => {
    await sut.createDirectory(new Path('dir/nested'));
    await sut.write(new Path('dir/nested/a.txt'), new Uint8Array());
    expect(await sut.list(new Path('dir'))).toEqual<ListEntry[]>([
      { path: new Path('dir/nested'), kind: 'dir' },
    ]);
  });
  test('list_recursive', async () => {
    await sut.createDirectory(new Path('dir/nested'));
    await sut.write(new Path('dir/nested/a.txt'), new Uint8Array());
    expect(await sut.list(new Path('dir'), { recursive: true })).toEqual<ListEntry[]>([
      { path: new Path('dir/nested'), kind: 'dir' },
      { path: new Path('dir/nested/a.txt'), kind: 'file' },
    ]);
  });

  test('chroot', async () => {
    await sut.write(new Path('a/b/c.txt'), new Uint8Array());
    const nested = await sut.chroot(new Path('a/b'));
    expect(await nested.fileExists(new Path('c.txt'))).toBe(true);
    await nested.deleteFile(new Path('c.txt'));
    expect(await sut.fileExists(new Path('a/b/c.txt'))).toBe(false);
  });
});
