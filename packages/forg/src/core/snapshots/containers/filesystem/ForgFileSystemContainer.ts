import { ForgContainer } from "../ForgContainer";
import { ForgContainerConfigJsonDto } from '../ForgContainerConfigJsonDto';
import { GitTreeFS } from "../../../../git";
import { HeadInfo } from "../../../model";


export class ForgFileSystemContainer extends ForgContainer {
  static readonly TYPE: string = 'forg.fileSystem';
  static readonly TYPE_VERSION: string = '0.0.1-preview';

  constructor(
    head: HeadInfo,
    rootFS: GitTreeFS,
    config: ForgContainerConfigJsonDto,
  ) {
    super(head, rootFS);

    if (config.type !== ForgFileSystemContainer.TYPE || config.typeVersion !== ForgFileSystemContainer.TYPE_VERSION) {
      throw new Error(`Unexpected filesystem container with type '${config.type}' and version '${config.typeVersion}', expected '${ForgFileSystemContainer.TYPE}' and '${ForgFileSystemContainer.TYPE_VERSION}'`);
    }
  }

  protected override reconcileCore(_other: ForgFileSystemContainer): Promise<GitTreeFS> {
    const result = GitTreeFS.fromWorkingTree(this.rootFS.repo, { type: 'tree', entries: {} });
    return Promise.resolve(result);
  }
}
