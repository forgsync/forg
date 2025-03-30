import { InMemoryFS, Path } from '@forgsync/simplefs';
import { defaultForgContainerMerger } from './ForgContainerMerger';
import { ForgContainerConfigJsonDto } from './ForgContainerConfigJsonDto';
import { encode } from '../../../git/db/encoding/util';
import { GitTreeFS, InitMode, Repo } from '../../../git';
import { HeadInfo } from '../../model';
import { ForgContainer } from './ForgContainer';

const dummyHead = {} as HeadInfo;

describe('ForgContainerMerger', () => {
  let goodContainerA: ForgContainer;
  let goodContainerB: ForgContainer;
  let goodContainerBase: ForgContainer;
  let badContainerA: ForgContainer;
  let badContainerB: ForgContainer;
  let badContainerBase: ForgContainer;
  let otherRepoContainer: ForgContainer;
  beforeEach(async () => {
    const repo = await createInMemoryRepo();
    const fsA = await createWorkingDir(repo);
    const fsB = await createWorkingDir(repo);
    const fsBase = await createWorkingDir(repo);

    goodContainerA = await ForgContainer.create(dummyHead, await fsA.chroot(new Path('containers/good')));
    goodContainerB = await ForgContainer.create(dummyHead, await fsB.chroot(new Path('containers/good')));
    goodContainerBase = await ForgContainer.create(dummyHead, await fsBase.chroot(new Path('containers/good')));

    badContainerA = await ForgContainer.create(dummyHead, await fsA.chroot(new Path('containers/bad')));
    badContainerB = await ForgContainer.create(dummyHead, await fsB.chroot(new Path('containers/bad')));
    badContainerBase = await ForgContainer.create(dummyHead, await fsBase.chroot(new Path('containers/bad')));

    const otherRepo = await createInMemoryRepo();
    const otherRepoFS = await createWorkingDir(otherRepo);
    otherRepoContainer = await ForgContainer.create(dummyHead, await otherRepoFS.chroot(new Path('containers/good')));
  });

  test('merge works for forg.fileSystem container', async () => {
    const merger = defaultForgContainerMerger();
    const container = await merger.merge(goodContainerA, goodContainerB, goodContainerBase);
    expect(await container.rootFS.fileExists(new Path('.forgcontainer.json'))).toBe(true);
  });

  test('merge fails for unknown type', async () => {
    const merger = defaultForgContainerMerger();
    await expect(() => merger.merge(badContainerA, badContainerB, badContainerBase)).rejects.toThrow(/No merger for containers with configs/);
  });

  test('merge fails for mismatched repos', async () => {
    const merger = defaultForgContainerMerger();
    await expect(() => merger.merge(goodContainerA, otherRepoContainer, goodContainerBase)).rejects.toThrow(/Containers to be merged must all come from the same repo/);
  });

  test('merge fails for mismatched container types', async () => {
    const merger = defaultForgContainerMerger();
    await expect(() => merger.merge(goodContainerA, goodContainerB, badContainerBase)).rejects.toThrow(/Mismatched container types \/ versions/);
  });
});

async function createInMemoryRepo(): Promise<Repo> {
  const repoFS = new InMemoryFS();
  const repo = new Repo(repoFS);
  await repo.init(InitMode.CreateIfNotExists);
  return repo;
}

async function createWorkingDir(repo: Repo) {
  const fs = GitTreeFS.fromWorkingTree(repo, { type: 'tree', entries: {} });

  const goodConfig: ForgContainerConfigJsonDto = {
    type: 'forg.fileSystem',
    typeVersion: '0.0.1-preview',
  };
  await fs.write(new Path('containers/good/.forgcontainer.json'), encode(JSON.stringify(goodConfig)));

  const badConfig: ForgContainerConfigJsonDto = {
    type: 'unknownType',
    typeVersion: 'unknownVersion',
  };
  await fs.write(new Path('containers/bad/.forgcontainer.json'), encode(JSON.stringify(badConfig)));

  await fs.save();
  return fs;
}