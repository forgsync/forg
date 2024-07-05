import { Repo, init } from '@forg/forg/dist/src/git';
import { FileStorage } from '@flystorage/file-storage';
import { InMemoryStorageAdapter } from '@flystorage/in-memory';

export async function myFunc(): Promise<void> {
  const adapter = new InMemoryStorageAdapter();
  const fs = new FileStorage(adapter);

  console.log('Writing file...');
  await fs.write('abc', 'aa');
  console.log('Reading file...');
  console.log(await fs.readToString('abc'));
  console.log();

  const repo = new Repo(fs);

  await init(repo);
  //await commit(repo, "main",
}
