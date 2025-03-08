import { InMemoryFS, Path } from '@forgsync/simplefs';
import { defaultForgContainerFactory } from './ForgContainerFactory';
import { ForgFileSystemContainer } from './filesystem/ForgFileSystemContainer';
import { ForgContainerConfigJsonDto } from './ForgContainerConfigJsonDto';
import { encode } from '../../../git/db/encoding/util';

describe('ForgContainerFactory', () => {
  let fs: InMemoryFS;
  beforeEach(async () => {
    fs = new InMemoryFS();

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
    const container = await factory.resolve(containerFS);
    expect(container).toBeInstanceOf(ForgFileSystemContainer);
    expect(await container.root.fileExists(new Path('.forgcontainer.json'))).toBe(true);
  });

  test('resolve fails for unknown type', async () => {
    const factory = defaultForgContainerFactory();
    const containerFS = await fs.chroot(new Path('containers/bad'));
    await expect(() => factory.resolve(containerFS)).rejects.toThrow(/No resolver for container with config/);
  });
});
