import { Errno, FSError, Path } from '@forgsync/simplefs';
import { GitTreeFS } from "../../git";
import { ForgContainerFactory } from './containers/ForgContainerFactory';
import { ForgContainer } from './containers/ForgContainer';

const containersDir = new Path('containers');

export class ForgSnapshot {
  constructor(
    private readonly commitRoot: GitTreeFS,
    private readonly containerFactory: ForgContainerFactory,
  ) {
  }

  async listContainers(): Promise<string[]> {
    const entries = await this.commitRoot.list(containersDir);
    return entries.filter(e => e.kind === 'dir').map(e => e.path.leafName);
  }

  async getContainer(name: string): Promise<ForgContainer> {
    const container = await this.getContainerIfExists(name);
    if (container === undefined) {
      throw new Error(`Container not found: '${name}'`);
    }

    return container;
  }

  async getContainerIfExists(name: string): Promise<ForgContainer | undefined> {
    const namePath = Path.join(containersDir, new Path(name));
    if (namePath.numSegments !== containersDir.numSegments + 1) {
      throw new Error(`Container name must be a single segment, found ${namePath.numSegments}: '${name}'`);
    }

    let containerFS: GitTreeFS;
    try {
      containerFS = await this.commitRoot.chroot(namePath);
    }
    catch (error) {
      if (error instanceof FSError && error.errno === Errno.ENOENT) {
        return undefined;
      }

      throw error;
    }

    return await this.containerFactory.resolve(containerFS);
  }

  async getContainersRoot(): Promise<GitTreeFS> {
    return await this.commitRoot.chroot(containersDir);
  }
}
