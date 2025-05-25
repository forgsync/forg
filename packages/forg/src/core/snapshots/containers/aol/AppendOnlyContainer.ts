import { ExpandedTree, IRepo } from "../../../../git";
import { Mutex } from "./Mutex";
import { ExpandedFile, expandSubTree, WorkingTreeEntry } from "../../../../git/db/workingTree";

const MaxEntriesPerTree = 256;
export class AppendOnlyContainer {
  private readonly mutex = new Mutex();
  private readonly repo: IRepo;
  private _root: ExpandedTree;

  get root() { return this._root; }

  constructor(repo: IRepo, root: ExpandedTree) {
    this.repo = repo;
    this._root = root;
  }

  async count(): Promise<number> {
    return await this.mutex.run(async () => {
      const result = await this._tryGetActiveSubtree(this._root, 0, 0);
      if (result.num === 0 && result.activeSubtree !== undefined && result.activeSubtree.nextNum === 0) {
        return 0;
      }

      return result.num + 1;
    });
  }

  async append(data: Uint8Array): Promise<void> {
    return await this.mutex.run(async () => {
      const pseudoRoot: ExpandedTree = {
        type: "tree",
        entries: new Map<string, WorkingTreeEntry>([
          [formatFileName(0), this._root],
        ]),
      }
      const result = await this._tryGetActiveSubtree(pseudoRoot, 0, 0);
      if (result.activeSubtree === undefined) {
        throw new Error(); // This should never happen
      }

      const newItem: ExpandedFile = {
        type: "file",
        body: data,
      };
      result.activeSubtree.tree.entries.set(formatFileName(result.activeSubtree.nextNum), newItem);

      if (pseudoRoot.entries.size > 1) {
        // Added a new level. Must swap root
        this._root = pseudoRoot;
      }

      this._root.originalHash = undefined;
    });
  }

  private async _tryGetActiveSubtree(tree: ExpandedTree, depth: number, baseNum: number): Promise<{ depth: number; num: number; activeSubtree: { tree: ExpandedTree, nextNum: number } | undefined }> {
    const type = validateEntries(tree);
    if (tree.entries.size === 0) {
      return { depth, num: baseNum, activeSubtree: { tree, nextNum: 0 } };
    }

    const lastName = Array.from(tree.entries.keys()).pop()!;
    const num = parseFileName(lastName);

    let maxDepth = depth;
    let maxNum = baseNum + num;
    if (type === "tree") {
      const subtree = await expandSubTree(this.repo, tree, lastName);
      const result = await this._tryGetActiveSubtree(subtree, depth + 1, maxNum * MaxEntriesPerTree);
      if (result.activeSubtree !== undefined) {
        // Found a subtree with room for another entry
        return result;
      }

      maxDepth = result.depth;
      maxNum = result.num;
    }

    if (num === MaxEntriesPerTree - 1) {
      // No more room in this subtree
      return { depth: maxDepth, num: maxNum, activeSubtree: undefined };
    }

    if (type === "tree") {
      // Create a new subtree in the current tree
      tree.originalHash = undefined;
      let current = tree;
      for (let d = depth; d < maxDepth; d++) {
        const newSubtree: ExpandedTree = {
          type: "tree",
          entries: new Map<string, WorkingTreeEntry>(),
        };
        current.entries.set(formatFileName(current === tree ? num + 1 : 0), newSubtree);
        current = newSubtree;
      }
      return { depth: maxDepth, num: maxNum, activeSubtree: { tree: current, nextNum: 0 } };
    }
    else {
      return { depth, num: maxNum, activeSubtree: { tree, nextNum: num + 1 } };
    }
  }
}

function validateEntries(tree: ExpandedTree): 'file' | 'tree' {
  if (tree.entries.size > MaxEntriesPerTree) {
    throw new Error(`Too many entries in subtree, expected up to ${MaxEntriesPerTree}, found ${tree.entries.size}`);
  }

  let expectedType: 'file' | 'tree' = 'file';
  let i = 0;
  for (const [name, entry] of tree.entries) {
    const expected = formatFileName(i);
    if (name !== expected) {
      throw new Error(`Wrong file name. Found '${name}', expected ${expected}`);
    }

    if (i === 0) {
      expectedType = entry.type;
    }
    else {
      if (entry.type !== expectedType) {
        throw new Error(`Unexpected ${entry.type} entry, expected ${expectedType}`);
      }
    }

    i++;
  }

  return expectedType;
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
