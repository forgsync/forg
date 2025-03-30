import { ForgContainer } from "../ForgContainer";
import { ForgFileSystemContainer } from "./ForgFileSystemContainer";

export async function fileSystemContainerMerger(a: ForgContainer, b: ForgContainer, base: ForgContainer): Promise<ForgContainer | undefined> {
  if (!checkType(a) || !checkType(b) || !checkType(base)) {
    return undefined;
  }

  // TODO: Implement merger
  return a;
}

function checkType(container: ForgContainer) {
  return container.config.type === ForgFileSystemContainer.TYPE && container.config.typeVersion === ForgFileSystemContainer.TYPE_VERSION;
}