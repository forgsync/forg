import { InMemoryFS, Path } from '@forgsync/simplefs';
import { defaultForgContainerFactory } from './ForgContainerFactory';
import { ForgFileSystemContainer } from './filesystem/ForgFileSystemContainer';
import { encode } from '../../git/db/encoding/util';
import { ForgContainerConfigJsonDto } from './ForgContainerConfigJsonDto';

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
  });

  test('resolve fails for unknown type', async () => {
    const factory = defaultForgContainerFactory();
    const containerFS = await fs.chroot(new Path('containers/bad'));
    await expect(factory.resolve(containerFS)).rejects.toThrow(/No resolver for container with config/);
  });
});
