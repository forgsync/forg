import { InMemoryFS } from '@forgsync/simplefs';
import { AppendOnlyContainer } from './AppendOnlyContainer';
import { Repo, InitMode, ExpandedTree } from '../../../../git';

describe('AppendOnlyContainer', () => {
  test('append and count works from 0 to 65537', async () => {
    const repo = await createInMemoryRepo();
    let root: ExpandedTree = { type: 'tree', entries: new Map() };
    const sut = new AppendOnlyContainer(repo, root);

    expect(await sut.count()).toBe(0);
    for (let i = 0; i < 256 * 256 + 1; i++) {
      await sut.append(new Uint8Array());
      expect(await sut.count()).toBe(i + 1);
    }

    root = sut.root;
    //console.log(JSON.stringify(fs.root, (_k, v) => v instanceof Map ? Array.from(v.entries()) : v, 2));

    const item_00 = root.entries.get('00') as ExpandedTree;
    expect(item_00).toBeDefined();

    const item_00_00 = item_00.entries.get('00') as ExpandedTree;
    expect(item_00_00).toBeDefined();
    expect(item_00_00.entries.get('00')).toBeDefined();
    expect(item_00_00.entries.get('ff')).toBeDefined();

    const item_00_ff = item_00.entries.get('ff') as ExpandedTree;
    expect(item_00_ff).toBeDefined();
    expect(item_00_ff.entries.get('00')).toBeDefined();
    expect(item_00_ff.entries.get('ff')).toBeDefined();

    const item_01 = root.entries.get('01') as ExpandedTree;
    expect(item_01).toBeDefined();

    const item_01_00 = item_01.entries.get('00') as ExpandedTree;
    expect(item_01_00).toBeDefined();
    expect(item_01_00.entries.get('00')).toBeDefined();
    expect(item_01_00.entries.get('01')).toBeUndefined();

    const item_01_01 = item_01.entries.get('01') as ExpandedTree;
    expect(item_01_01).toBeUndefined();

    const item_02 = root.entries.get('02') as ExpandedTree;
    expect(item_02).toBeUndefined();
  });
});

async function createInMemoryRepo(): Promise<Repo> {
  const repoFS = new InMemoryFS();
  const repo = new Repo(repoFS);
  await repo.init(InitMode.CreateIfNotExists);
  return repo;
}
