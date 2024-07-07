import { FileStorage } from '@flystorage/file-storage';
import { InMemoryStorageAdapter } from '@flystorage/in-memory';
import { createCommit, loadObject, Person, Repo, updateRef, walkTree } from '@forg/forg/dist/git';
import { encode } from '@forg/forg/dist/git/encoding/util';
import { isFile } from '@forg/forg/dist/git/util';

export async function myFunc(): Promise<void> {
  const adapter = new InMemoryStorageAdapter();
  const fs = new FileStorage(adapter);
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
    },};
  const hash = await createCommit(
    repo,
    {
      files: {
        'a.txt': {
          isExecutable: false,
          body: encode('aa'),
        },
      },
      folders: {
        b: {
          files: {
            'c.txt': {
              isExecutable: false,
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

  const commitObject = await loadObject(repo, hash);
  if (commitObject.type !== 'commit') {
    throw new Error('not a commit!');
  }

  for await (const leaf of walkTree(repo, commitObject.body.tree)) {
    if (isFile(leaf.mode)) {
      console.log(`File: ${leaf.path.join('/')} : ${leaf.hash}`);
    }
  }
}
