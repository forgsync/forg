import { InMemoryFS } from '@forgsync/simplefs';
import { GitTreeFS, InitMode, Repo } from '../../../git';
import { ForgContainer } from './ForgContainer';

describe('ForgContainer', () => {
  test('reconcile works', async () => {
    const fs = await createInMemoryGitTreeFS();
    const a = new A(fs);
    const b = new A(fs);

    expect(await a.reconcile(b)).toBe(a.rootFS);
  });

  test('reconcile detects mismatched types', async () => {
    const fs = await createInMemoryGitTreeFS();
    const a = new A(fs);
    const b = new B(fs);

    expect(() => a.reconcile(b)).toThrow('Mismatched container types');
  });

  test('reconcile detects mismatched filesystems', async () => {
    const a = new A(await createInMemoryGitTreeFS());
    const b = new A(await createInMemoryGitTreeFS());

    expect(() => a.reconcile(b)).toThrow("Mismatched repo's");
  });
});

class A extends ForgContainer {
  constructor(rootFS: GitTreeFS) {
    super(rootFS);
  }

  protected reconcileCore(_other: A): Promise<GitTreeFS> {
    return Promise.resolve(this.rootFS);
  }
}

class B extends ForgContainer {
  constructor(rootFS: GitTreeFS) {
    super(rootFS);
  }

  protected reconcileCore(_other: B): Promise<GitTreeFS> {
    return Promise.resolve(this.rootFS);
  }
}

async function createInMemoryGitTreeFS(): Promise<GitTreeFS> {
  const repoFS = new InMemoryFS();
  const repo = new Repo(repoFS);
  await repo.init(InitMode.CreateIfNotExists);
  const fs = GitTreeFS.fromWorkingTree(repo, { type: 'tree', entries: {} });
  await fs.save();
  return fs;
}
