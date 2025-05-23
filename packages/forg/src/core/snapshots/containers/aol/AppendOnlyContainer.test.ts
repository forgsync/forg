import { InMemoryFS } from '@forgsync/simplefs';
import { AppendOnlyContainer } from './AppendOnlyContainer';
import { GitTreeFS, Repo, InitMode, ExpandedTree } from '../../../../git';

describe('AppendOnlyContainer', () => {
  test('append works from 0 to 65537', async () => {
    const fs = await createInMemoryGitTreeFS();
    const sut = new AppendOnlyContainer(fs);

    for (let i = 0; i < 256 * 256 + 1; i++) {
      await sut.append(new Uint8Array());
    }

    const item_00 = fs.root.entries['00'] as ExpandedTree;
    expect(item_00).toBeDefined();

    const item_00_00 = item_00.entries['00'] as ExpandedTree;
    expect(item_00_00).toBeDefined();
    expect(item_00_00.entries['00']).toBeDefined();
    expect(item_00_00.entries['ff']).toBeDefined();

    const item_00_ff = item_00.entries['ff'] as ExpandedTree;
    expect(item_00_ff).toBeDefined();
    expect(item_00_ff.entries['00']).toBeDefined();
    expect(item_00_ff.entries['ff']).toBeDefined();

    const item_01 = fs.root.entries['01'] as ExpandedTree;
    expect(item_01).toBeDefined();

    const item_01_00 = item_01.entries['00'] as ExpandedTree;
    expect(item_01_00).toBeDefined();
    expect(item_01_00.entries['00']).toBeDefined();
    expect(item_01_00.entries['01']).toBeUndefined();

    const item_01_01 = item_01.entries['01'] as ExpandedTree;
    expect(item_01_01).toBeUndefined();

    const item_02 = fs.root.entries['02'] as ExpandedTree;
    expect(item_02).toBeUndefined();
  });
});

async function createInMemoryGitTreeFS(): Promise<GitTreeFS> {
  const repoFS = new InMemoryFS();
  const repo = new Repo(repoFS);
  await repo.init(InitMode.CreateIfNotExists);
  const fs = GitTreeFS.fromWorkingTree(repo, { type: 'tree', entries: {} });
  await fs.save();
  return fs;
}
