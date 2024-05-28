import { InMemoryFS, Repo, init } from '@forg/forg/dist/src/git';

export async function myFunc(): Promise<void> {
  const fs = new InMemoryFS();
  const repo = new Repo(fs);

  const a: number = 1;

  await init(repo);
  //await commit(repo, "main",
}
