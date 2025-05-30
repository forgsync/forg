import { Hash, Mode } from './model';
import { CommitBody, loadCommitObject, loadTreeObject } from './objects';
import { IRepo } from './Repo';
import { isFile } from './util';

export type HashAndCommitBody = {
  readonly hash: Hash;
  readonly commit: CommitBody;
};

export type HashModePath = {
  readonly hash: Hash;
  readonly mode: Mode;
  readonly path: string[];
};

export async function* walkCommits(repo: IRepo, ...hash: Hash[]): AsyncGenerator<HashAndCommitBody, void, boolean | undefined> {
  const queue = hash;
  const visited = new Set<Hash>(queue);
  while (queue.length > 0) {
    const hash = queue.shift();
    if (!hash) {
      return;
    }
    const commit = await loadCommitObject(repo, hash);
    const visitParents = yield { hash, commit: commit.body };
    if (visitParents === false) {
      continue;
    }
    for (const parent of commit.body.parents) {
      if (visited.has(parent)) {
        continue;
      }
      visited.add(parent);
      queue.push(parent);
    }
  }
}

export async function* walkTree(repo: IRepo, hash: Hash, parentPath: string[] = []): AsyncGenerator<HashModePath> {
  const tree = await loadTreeObject(repo, hash);
  for (const name of Object.keys(tree.body)) {
    const { mode, hash } = tree.body[name];
    const path = [...parentPath, name];
    if (isFile(mode)) {
      yield { mode, hash, path };
    } else if ((yield { mode, hash, path }) !== false) {
      yield* walkTree(repo, hash, path);
    }
  }
}

export async function* listFiles(repo: IRepo, hash: Hash) {
  for await (const entry of walkTree(repo, hash)) {
    if (isFile(entry.mode)) yield entry;
  }
}
