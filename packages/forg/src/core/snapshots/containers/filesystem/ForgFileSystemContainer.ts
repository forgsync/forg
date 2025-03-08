import { ISimpleFS } from "@forgsync/simplefs";
import { ForgContainer } from "../ForgContainer";
import { ForgContainerConfigJsonDto } from '../ForgContainerConfigJsonDto';


export class ForgFileSystemContainer extends ForgContainer {
  static readonly TYPE: string = 'forg.fileSystem';
  static readonly TYPE_VERSION: string = '0.0.1-preview';

  constructor(
    root: ISimpleFS,
    config: ForgContainerConfigJsonDto,
  ) {
    super(root);

    if (config.type !== ForgFileSystemContainer.TYPE || config.typeVersion !== ForgFileSystemContainer.TYPE_VERSION) {
      throw new Error(`Unexpected filesystem container with type '${config.type}' and version '${config.typeVersion}', expected '${ForgFileSystemContainer.TYPE}' and '${ForgFileSystemContainer.TYPE_VERSION}'`);
    }
  }

  override reconcile(other: ForgContainer): Promise<void> {
    if (!(other instanceof ForgFileSystemContainer)) {
      throw new Error("Mismatched container types");
    }

    throw new Error("Method not implemented.");
  }
}
