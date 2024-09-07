import {
  createCommit,
  loadCommitObject,
  loadTreeObject,
  Person,
  Repo,
  treeToWorkingTree,
  updateRef,
  walkTree,
} from '@forgsync/forg/dist/repo/git';
import { encode } from '@forgsync/forg/dist/repo/git/internal/encoding/util';
import { isFile } from '@forgsync/forg/dist/repo/git/internal/util';
import { GitTreeFS } from '@forgsync/forg/dist/repo/treefs';
import { InMemoryFS, Path } from '@forgsync/simplefs';

export async function myFunc(): Promise<void> {
  const fs = new InMemoryFS();
  const repo = new Repo(fs);

  console.log('Initing...');
  await repo.init();
  console.log('Commiting...');

  const person: Person = {
    name: 'test',
    email: '',
    date: {
      seconds: 1234,
      offset: 0,
    },
  };
  const hash = await createCommit(
    repo,
    {
      type: 'tree',
      entries: {
        'a.txt': {
          type: 'file',
          body: encode('aa'),
        },
        b: {
          type: 'tree',
          entries: {
            'c.txt': {
              type: 'file',
              body: encode('cc'),
            },
          },
        },
      },
    },
    [],
    'Initial commit',
    person,
  );
  await updateRef(repo, 'refs/main', hash, person, 'commit (initial): Initial commit');

  console.log('Reading reflog...');
  const reflog = await repo.getReflog('refs/main');
  console.log(reflog);
  console.log();

  const commitObject = await loadCommitObject(repo, hash);
  console.log('walkTree:');
  for await (const leaf of walkTree(repo, commitObject.body.tree)) {
    if (isFile(leaf.mode)) {
      console.log(`  File: ${leaf.path.join('/')} : ${leaf.hash}`);
    }
  }

  const treeObject = await loadTreeObject(repo, commitObject.body.tree);
  const treefs = GitTreeFS.fromTree(repo, treeObject);
  console.log('GitTreeFS:');
  for (const entry of await treefs.list(new Path(''))) {
    console.log(`  Entry: ${entry.path.value} : ${entry.kind}`);
  }
}
