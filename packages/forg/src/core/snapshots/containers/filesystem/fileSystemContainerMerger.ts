import { ListEntry } from "@forgsync/simplefs";
import { ForgContainer } from "../ForgContainer";
import { ForgFileSystemContainer } from "./ForgFileSystemContainer";
import parallelTraverse from "./parallelTraverse";
import { GitTreeFS } from "../../../../git";

export async function fileSystemContainerMerger(a: ForgContainer, b: ForgContainer, base: ForgContainer): Promise<ForgContainer | undefined> {
  if (!checkType(a) || !checkType(b) || !checkType(base)) {
    return undefined;
  }

  // TODO: Implement merger
  await parallelTraverse(
    [base.rootFS, a.rootFS, b.rootFS],
    async (_path, [entryBase, entryA, entryB]) => {
      const aChanged = await isModified(entryA && { fs: a.rootFS, entry: entryA }, entryBase && { fs: base.rootFS, entry: entryBase });
      const bChanged = await isModified(entryB && { fs: b.rootFS, entry: entryB }, entryBase && { fs: base.rootFS, entry: entryBase });

      if (aChanged === false && bChanged === false) {
      }
      else if (aChanged === false && bChanged === true) {
      }
      else if (aChanged === true && bChanged === false) {
      }
      else /* if (aChanged == true && bChanged == true) */ {
      }

      return _path;
    },
    async t => { return t; }
  );
  return a;
}

function checkType(container: ForgContainer) {
  return container.config.type === ForgFileSystemContainer.TYPE && container.config.typeVersion === ForgFileSystemContainer.TYPE_VERSION;
}

interface EntryInFS {
  fs: GitTreeFS;
  entry: ListEntry;
}
async function isModified(a: EntryInFS | undefined, b: EntryInFS | undefined) {
  if (a === undefined && b === undefined) {
    return false;
  }

  if (a === undefined || b === undefined) {
    return true;
  }

  if (a.entry.kind === "dir" && b.entry.kind === "dir") {
    // They are both folders, so not modified per se; we will traverse children later...
    return false;
  }

  if (a.entry.kind === "file" && b.entry.kind === "file") {
    const entryA = await a.fs.tryFindEntry(a.entry.path);
    const entryB = await b.fs.tryFindEntry(b.entry.path);
    if (!(entryA !== undefined && 'hash' in entryA) || !(entryB !== undefined && 'hash' in entryB)) {
      throw new Error('Expected entries to be existing files on both sides (hash should be known)');
    }

    return entryA.hash !== entryB.hash;
  }

  // One is a file, the other is a tree
  return true;
}
