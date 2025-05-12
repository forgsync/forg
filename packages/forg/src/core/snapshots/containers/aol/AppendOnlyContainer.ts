import { ExpandedTree, GitTreeFS } from "../../../../git";
import { Mutex } from "./Mutex";
import { ExpandedFile, expandSubTree } from "../../../../git/db/workingTree";

const MaxEntriesPerTree = 256;
export class AppendOnlyContainer {
  private readonly fs: GitTreeFS;
  private readonly mutex = new Mutex();

  constructor(fs: GitTreeFS) {
    this.fs = fs;
  }

  async count(): Promise<void> {
    return await this.mutex.run(async () => {
    });
  }

  async append(data: Uint8Array): Promise<void> {
    return await this.mutex.run(async () => {
      const root = this.fs.root;

      const newItem: ExpandedFile = {
        type: "file",
        body: data,
      };
      const pseudoRoot: ExpandedTree = {
        type: "tree",
        entries: {
          [formatFileName(0)]: root,
        }
      }
      const result = await this.tryGetActiveSubtree(pseudoRoot, 0);
      if (result.activeSubtree === undefined) {
        throw new Error(); // This should never happen
      }

      result.activeSubtree.tree.entries[formatFileName(result.activeSubtree.nextNum)] = newItem;

      if (Object.keys(pseudoRoot.entries).length > 1) {
        // Added a new level. Must swap root
        const rootClone: ExpandedTree = {
          ...root,
          entries: { ...root.entries },
        };
        this.fs.root.entries = {
          ...pseudoRoot.entries,
          [formatFileName(0)]: rootClone,
        };
      }

      // TODO: This is hacky and confusing because we are mixing GitTreeFS with raw manipulation of tree objects
      this.fs.root.originalHash = undefined;
    });
  }

  async tryGetActiveSubtree(tree: ExpandedTree, depth: number): Promise<{ depth: number; activeSubtree: { tree: ExpandedTree, nextNum: number } | undefined }> {
    const { names, type } = validateEntries(tree);
    if (names.length === 0) {
      return { depth, activeSubtree: { tree, nextNum: 0 } };
    }

    const lastName = names[names.length - 1];
    const num = parseFileName(lastName);
    const isFull = num >= MaxEntriesPerTree - 1;

    let maxDepth = depth;
    if (type === "tree") {
      const subtree = await expandSubTree(this.fs.repo, tree, lastName);
      const result = await this.tryGetActiveSubtree(subtree, depth + 1);
      if (result.activeSubtree !== undefined) {
        // Found a subtree with room for another entry
        return result;
      }

      maxDepth = result.depth;
    }

    if (isFull) {
      // No more room in this subtree
      return { depth: maxDepth, activeSubtree: undefined };
    }

    if (type === "tree") {
      // Create a new subtree in the current tree
      tree.originalHash = undefined;
      let current = tree;
      for (let d = depth; d < maxDepth; d++) {
        const newSubtree: ExpandedTree = {
          type: "tree",
          entries: {},
        };
        current.entries[formatFileName(current === tree ? num + 1 : 0)] = newSubtree;
        current = newSubtree;
      }
      return { depth: maxDepth, activeSubtree: { tree: current, nextNum: 0 } };
    }
    else {
      return { depth, activeSubtree: { tree, nextNum: num + 1 } };
    }
  }
}

function validateEntries(tree: ExpandedTree): { names: string[], type: 'file' | 'tree' } {
  const names = Object.keys(tree.entries).sort(); // TODO: Replace with map so that this isn't needed. This is because javascript sorts `01` differently than `10` because `10` is a legit number, and `01` is not; Proper numbers are always shown first :(
  if (names.length === 0) {
    return { names, type: 'file' };
  }

  if (names.length > MaxEntriesPerTree) {
    throw new Error(`Too many entries in subtree, expected up to ${MaxEntriesPerTree}, found ${names.length}`);
  }

  const type = tree.entries[names[0]].type;
  for (let i = 0; i < names.length; i++) {
    const expected = formatFileName(i);
    if (names[i] !== expected) {
      throw new Error(`Wrong file name. Found '${names[i]}', expected ${expected}`);
    }

    const actualType = tree.entries[expected].type;
    if (actualType !== type) {
      throw new Error(`Unexpected ${actualType} entry, expected ${type}`);
    }
  }

  return { names, type }
}

function formatFileName(num: number) {
  if (num < 0 || num >= 256) {
    throw new RangeError();
  }

  return (num | 0).toString(16).padStart(2, '0');
}

const fileNameRegex = /^[0-9a-f]{2}$/;
function parseFileName(name: string) {
  if (!fileNameRegex.exec(name)) {
    throw new Error(`Invalid format for name '${name}', expected to match regex '^[0-9a-f]{2}$'`);
  }

  return parseInt(name, 16);
}