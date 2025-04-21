import { Path, ListEntry, ISimpleFS } from "@forgsync/simplefs";
import { gitFileEntryComparer } from "../../../../git/db/util";

/**
 * Traverses multiple filesystems in parallel, calling the map/reduce functions for each unique path found across all filesystems.
 * @param fss File systems to traverse in parallel
 * @param mapFn Mapper function; it is called once for each entry that we scan across all file systems BEFORE we traverse children of said item, with an argument that describes the entry as found in each filesystem (or undefined if this entry does not exist in that filesystem).
 * Children are only traversed if the implementation returns a non-undefined value.
 * @param reduceFn Reducer function, called AFTER we traverse the children of each item, if any, and called with the value that the mapper function produced earlier
 */
export default function parallelTraverse<TMap extends {}, TReduce extends {}>(fss: ISimpleFS[], mapFn: (path: Path, entries: (ListEntry | undefined)[]) => Promise<TMap | undefined>, reduceFn: (parent: TMap, children: TReduce[]) => Promise<TReduce>): Promise<TReduce | undefined> {
  const root: ListEntry = { kind: 'dir', path: new Path('') };
  const roots = new Array<ListEntry>(fss.length).fill(root);
  return parallelTraverseImpl(fss, root.path, roots, mapFn, reduceFn);
}

async function parallelTraverseImpl<TMap extends {}, TReduce extends {}>(fss: ISimpleFS[], path: Path, entries: (ListEntry | undefined)[], mapFn: (path: Path, entries: (ListEntry | undefined)[]) => Promise<TMap | undefined>, reduceFn: (parent: TMap, children: TReduce[]) => Promise<TReduce>): Promise<TReduce | undefined> {
  const mappedParent = await mapFn(path, entries);
  if (mappedParent !== undefined) {
    const childEntries = await listChildren(fss, entries);
    const reducedChildren: TReduce[] = [];
    for (const [path, entries] of parallelScan(childEntries)) {
      const reducedChild = await parallelTraverseImpl(fss, path, entries, mapFn, reduceFn);
      if (reducedChild !== undefined) {
        reducedChildren.push(reducedChild);
      }
    }

    return await reduceFn(mappedParent, reducedChildren);
  }

  return undefined;
}

const emptyArrayPromise = Promise.resolve([]);
async function listChildren(fss: ISimpleFS[], entries: (ListEntry | undefined)[]): Promise<ListEntry[][]> {
  const childEntryPromises: Promise<ListEntry[]>[] = [];
  for (let i = 0; i < fss.length; i++) {
    const entry = entries[i];
    childEntryPromises.push(entry !== undefined && entry.kind === "dir" ? fss[i].list(entry.path) : emptyArrayPromise);
  }

  const childEntries = await Promise.all(childEntryPromises);
  return childEntries;
}

interface ParallelScanHead {
  iterator: ArrayIterator<ListEntry>;
  current: ListEntry | undefined;
}

function* parallelScan(arrays: ListEntry[][]): Generator<[path: Path, values: (ListEntry | undefined)[]]> {
  const heads: ParallelScanHead[] = arrays.map(array => {
    array.sort(gitFileEntryComparer);
    const iterator = array[Symbol.iterator]();
    return { iterator, current: iterator.next().value } satisfies ParallelScanHead;
  });

  let min: Path | undefined;
  while ((min = findMin(heads)) !== undefined) {
    const thisRow = new Array<ListEntry | undefined>(arrays.length).fill(undefined); // Fill with undefined, otherwise the default `empty`-element behavior causes confusing results
    for (let i = 0; i < heads.length; i++) {
      const head = heads[i];
      if (head.current?.path.value === min.value) {
        thisRow[i] = head.current;
        head.current = head.iterator.next().value;
      }
    }

    yield [min, thisRow];
  }
}

function findMin(heads: ParallelScanHead[]): Path | undefined {
  let min: Path | undefined = undefined;
  for (const head of heads) {
    if (head.current !== undefined) {
      const val = head.current.path;
      if (min === undefined || val.value < min.value) {
        min = val;
      }
    }
  }

  return min;
}
