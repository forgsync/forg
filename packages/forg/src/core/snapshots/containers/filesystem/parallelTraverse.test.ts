import { InMemoryFS, ListEntry, Path } from '@forgsync/simplefs';
import parallelTraverse from './parallelTraverse';

describe('parallelTraverse', () => {
  test('basics', async () => {
    const fs1 = new InMemoryFS();
    await fs1.createDirectory(new Path('emptyFolder'));
    await fs1.write(new Path('a/b/c'), new Uint8Array());
    await fs1.write(new Path('a/b/d'), new Uint8Array());
    await fs1.write(new Path('a/e'), new Uint8Array());
    await fs1.write(new Path('b'), new Uint8Array());

    const fs2 = new InMemoryFS();
    await fs2.write(new Path('a/b/d'), new Uint8Array());
    await fs2.write(new Path('a/e/f'), new Uint8Array());
    await fs2.write(new Path('d'), new Uint8Array());

    const mapped: { seq: number, path: Path, entries: (ListEntry | undefined)[] }[] = [];
    const reduced: { seq: number, parent: Path, children: Path[] }[] = [];
    let counter = 0;
    await parallelTraverse(
      [fs1, fs2],
      async (path, entries) => {
        //console.log(`MAP: ${JSON.stringify(path.value)} -- ${JSON.stringify(entries.map(e => e === undefined ? '--' : e.kind))}`);
        mapped.push({ seq: counter++, path, entries });
        return path;
      }, async (parent, children: Path[]) => {
        //console.log(`REDUCE: ${JSON.stringify(parent.value)} with children: ${JSON.stringify(children)}`);
        reduced.push({ seq: counter++, parent, children });
        return parent;
      });

    expect(JSON.parse(JSON.stringify(mapped))).toEqual([
      { seq: 0, path: "", entries: [{ kind: "dir", path: "", }, { kind: "dir", path: "", },] },
      { seq: 1, path: "a", entries: [{ kind: "dir", path: "a", }, { kind: "dir", path: "a", },] },
      { seq: 2, path: "a/b", entries: [{ kind: "dir", path: "a/b", }, { kind: "dir", path: "a/b", },], },
      { seq: 3, path: "a/b/c", entries: [{ kind: "file", path: "a/b/c", }, null,], },
      { seq: 5, path: "a/b/d", entries: [{ kind: "file", path: "a/b/d", }, { kind: "file", path: "a/b/d", },], },
      { seq: 8, path: "a/e", entries: [{ kind: "file", path: "a/e", }, { kind: "dir", path: "a/e", },], },
      { seq: 9, path: "a/e/f", entries: [null, { kind: "file", path: "a/e/f", },], },
      { seq: 13, path: "b", entries: [{ kind: "file", path: "b", }, null,], },
      { seq: 15, path: "d", entries: [null, { kind: "file", path: "d", },], },
      { seq: 17, path: "emptyFolder", entries: [{ kind: "dir", path: "emptyFolder", }, null,], },
    ]);

    expect(JSON.parse(JSON.stringify(reduced))).toEqual([
      { seq: 4, parent: "a/b/c", children: [] },
      { seq: 6, parent: "a/b/d", children: [] },
      { seq: 7, parent: "a/b", children: ["a/b/c", "a/b/d"] },
      { seq: 10, parent: "a/e/f", children: [] },
      { seq: 11, parent: "a/e", children: ["a/e/f"] },
      { seq: 12, parent: "a", children: ["a/b", "a/e"] },
      { seq: 14, parent: "b", children: [] },
      { seq: 16, parent: "d", children: [] },
      { seq: 18, parent: "emptyFolder", children: [] },
      { seq: 19, parent: "", children: ["a", "b", "d", "emptyFolder"] },
    ]);
  });
});
