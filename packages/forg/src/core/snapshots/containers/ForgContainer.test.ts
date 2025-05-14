import { InMemoryFS, Path } from '@forgsync/simplefs';
import { GitTreeFS, InitMode, Repo } from '../../../git';
import { ForgContainer } from './ForgContainer';
import { HeadInfo } from '../../model';
import { ForgContainerConfigJsonDto } from './ForgContainerConfigJsonDto';
import { encode } from '../../../git/db/encoding/util';

const dummyHead = {} as HeadInfo;
describe('ForgContainer', () => {
  test('create works', async () => {
    const fs = await createInMemoryGitTreeFS();
    const containerRoot = await fs.chroot(new Path('containers/good'));
    const container = await ForgContainer.create(dummyHead, containerRoot);
    expect(container.config).toEqual<ForgContainerConfigJsonDto>({
      type: 'forg.fileSystem',
      typeVersion: '0.0.1-preview',
    });
  });

  test('create fails when config is missing', async () => {
    const fs = await createInMemoryGitTreeFS();
    const containerRoot = await fs.chroot(new Path('containers/empty'));
    await expect(() => ForgContainer.create(dummyHead, containerRoot)).rejects.toThrow(/Missing container config file/);
  });

  test('create fails when config is missing required fields', async () => {
    const fs = await createInMemoryGitTreeFS();
    const containerRoot = await fs.chroot(new Path('containers/missingFields'));
    await expect(() => ForgContainer.create(dummyHead, containerRoot)).rejects.toThrow(/missing required fields/);
  });
});

async function createInMemoryGitTreeFS(): Promise<GitTreeFS> {
  const repoFS = new InMemoryFS();
  const repo = new Repo(repoFS);
  await repo.init(InitMode.CreateIfNotExists);
  const fs = GitTreeFS.fromWorkingTree(repo, { type: 'tree', entries: new Map() });

  const goodConfig: ForgContainerConfigJsonDto = {
    type: 'forg.fileSystem',
    typeVersion: '0.0.1-preview',
  };
  await fs.write(new Path('containers/good/.forgcontainer.json'), encode(JSON.stringify(goodConfig)));

  await fs.createDirectory(new Path('containers/empty'));

  const missingFieldsConfig: ForgContainerConfigJsonDto = {
    type: 'forg.fileSystem',
    typeVersion: '',
  };
  await fs.write(new Path('containers/missingFields/.forgcontainer.json'), encode(JSON.stringify(missingFieldsConfig)));

  await fs.save();
  return fs;
}
