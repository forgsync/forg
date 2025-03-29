import { InMemoryFS } from '@forgsync/simplefs';
import { GitTreeFS, InitMode, Repo } from '../../../git';
import { ForgContainer } from './ForgContainer';
import { HeadInfo } from '../../model';

describe('ForgContainer', () => {
  const dummyHead = {} as HeadInfo;
  test('reconcile works', async () => {
    const fs = await createInMemoryGitTreeFS();
    const a = new A(dummyHead, fs);
    const b = new A(dummyHead, fs);

    expect(await a.reconcile(b)).toBe(a.rootFS);
  });

  test('reconcile detects mismatched types', async () => {
    const fs = await createInMemoryGitTreeFS();
    const a = new A(dummyHead, fs);
    const b = new B(dummyHead, fs);

    expect(() => a.reconcile(b)).toThrow('Mismatched container types');
  });

  test('reconcile detects mismatched filesystems', async () => {
    const a = new A(dummyHead, await createInMemoryGitTreeFS());
    const b = new A(dummyHead, await createInMemoryGitTreeFS());

    expect(() => a.reconcile(b)).toThrow("Mismatched repo's");
  });
});

class A extends ForgContainer {
  constructor(head: HeadInfo, rootFS: GitTreeFS) {
    super(head, rootFS);
  }

  protected reconcileCore(_other: A): Promise<GitTreeFS> {
    return Promise.resolve(this.rootFS);
  }
}

class B extends ForgContainer {
  constructor(head: HeadInfo, rootFS: GitTreeFS) {
    super(head, rootFS);
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
