import { InMemoryFS, Path } from '@forgsync/simplefs';
import { defaultForgContainerFactory } from './ForgContainerFactory';
import { ForgFileSystemContainer } from './filesystem/ForgFileSystemContainer';
import { ForgContainerConfigJsonDto } from './ForgContainerConfigJsonDto';
import { encode } from '../../../git/db/encoding/util';
import { GitTreeFS, InitMode, Repo } from '../../../git';
import { HeadInfo } from '../../model';

const dummyHead = {} as HeadInfo;

describe('ForgContainerFactory', () => {
  let fs: GitTreeFS;
  beforeEach(async () => {
    fs = await createInMemoryGitTreeFS();

    const goodConfig: ForgContainerConfigJsonDto = {
      type: 'forg.fileSystem',
      typeVersion: '0.0.1-preview',
    };
    fs.write(new Path('containers/good/.forgcontainer.json'), encode(JSON.stringify(goodConfig)));

    const badConfig: ForgContainerConfigJsonDto = {
      type: 'unknownType',
      typeVersion: 'unknownVersion',
    };
    fs.write(new Path('containers/bad/.forgcontainer.json'), encode(JSON.stringify(badConfig)));
  });

  test('resolve works for forg.fileSystem container', async () => {
    const factory = defaultForgContainerFactory();
    const containerFS = await fs.chroot(new Path('containers/good'));
    const container = await factory.resolve(dummyHead, containerFS);
    expect(container).toBeInstanceOf(ForgFileSystemContainer);
    expect(await container.rootFS.fileExists(new Path('.forgcontainer.json'))).toBe(true);
  });

  test('resolve fails for unknown type', async () => {
    const factory = defaultForgContainerFactory();
    const containerFS = await fs.chroot(new Path('containers/bad'));
    await expect(() => factory.resolve(dummyHead, containerFS)).rejects.toThrow(/No resolver for container with config/);
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
