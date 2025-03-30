import { Errno, FSError, Path } from '@forgsync/simplefs';
import { GitTreeFS, IRepo, loadTreeObject } from "../../git";
import { ForgContainer } from './containers/ForgContainer';
import { HeadInfo } from '../model';

const containersDir = new Path('containers');

export class ForgSnapshot {
  private constructor(
    readonly head: HeadInfo,
    private readonly commitRoot: GitTreeFS,
  ) {
  }

  static async create(repo: IRepo, head: HeadInfo): Promise<ForgSnapshot> {
    const tree = await loadTreeObject(repo, head.commit.body.tree);
    const treeFS = GitTreeFS.fromTree(repo, tree, head.commit.body.tree);
    return new ForgSnapshot(head, treeFS);
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

    return await ForgContainer.create(this.head, containerFS);
  }

  async getContainersRoot(): Promise<GitTreeFS> {
    return await this.commitRoot.chroot(containersDir);
  }
}
