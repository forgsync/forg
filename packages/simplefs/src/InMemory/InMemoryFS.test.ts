import { InMemoryFS } from './InMemoryFS';
import { Path } from '../model/Path';
import { ListEntry } from '../model/ISimpleFS';

describe('InMemoryFS', () => {
  test('constructor', () => {
    new InMemoryFS();
  });

  test('read non-existent file', async () => {
    const fs = new InMemoryFS();
    await expect(fs.read(new Path('a/c'))).rejects.toThrow(/ENOENT/);
  });

  test('read directory', async () => {
    const fs = new InMemoryFS();
    await fs.write(new Path('a/b/c'), new Uint8Array());
    await expect(fs.read(new Path('a/b'))).rejects.toThrow(/EISDIR/);
  });

  test('read existing file', async () => {
    const fs = new InMemoryFS();
    await fs.write(new Path('a/b'), new Uint8Array());
    await fs.read(new Path('a/b'));
  });

  test('list shallow', async () => {
    const fs = new InMemoryFS();
    await fs.write(new Path('a/b'), new Uint8Array());
    await fs.write(new Path('a/c'), new Uint8Array());
    await fs.write(new Path('a/d'), new Uint8Array());
    await fs.write(new Path('b'), new Uint8Array());

    const result1 = await fs.list(new Path(''));
    expect(result1).toEqual<ListEntry[]>([
      { kind: 'dir', path: new Path('a') },
      { kind: 'file', path: new Path('b') },
    ]);

    const result2 = await fs.list(new Path('a'));
    expect(result2).toEqual<ListEntry[]>([
      { kind: 'file', path: new Path('a/b') },
      { kind: 'file', path: new Path('a/c') },
      { kind: 'file', path: new Path('a/d') },
    ]);
  });

  test('list recursive', async () => {
    const fs = new InMemoryFS();
    await fs.write(new Path('a/b'), new Uint8Array());
    await fs.write(new Path('a/c'), new Uint8Array());
    await fs.write(new Path('a/d'), new Uint8Array());
    await fs.write(new Path('b'), new Uint8Array());
    const result1 = await fs.list(new Path(''), { recursive: true });
    expect(result1).toEqual<ListEntry[]>([
      { kind: 'dir', path: new Path('a') },
      { kind: 'file', path: new Path('a/b') },
      { kind: 'file', path: new Path('a/c') },
      { kind: 'file', path: new Path('a/d') },
      { kind: 'file', path: new Path('b') },
    ]);

    const result2 = await fs.list(new Path('a'), { recursive: true });
    expect(result2).toEqual<ListEntry[]>([
      { kind: 'file', path: new Path('a/b') },
      { kind: 'file', path: new Path('a/c') },
      { kind: 'file', path: new Path('a/d') },
    ]);
  });
});
