import { ForgContainer } from "./ForgContainer";
import { fileSystemContainerMerger } from "./filesystem/fileSystemContainerMerger";

export type MergeContainerFunc = (a: ForgContainer, b: ForgContainer, base: ForgContainer) => Promise<ForgContainer | undefined>;
export class ForgContainerMerger {
  private readonly mergers: MergeContainerFunc[] = [];

  addMerger(merger: MergeContainerFunc) {
    this.mergers.push(merger);
  }

  async merge(a: ForgContainer, b: ForgContainer, base: ForgContainer): Promise<ForgContainer> {
    if (a.rootFS.repo !== b.rootFS.repo || a.rootFS.repo !== base.rootFS.repo) {
      // If they are from different repo's, we would not be able to make some assumptions such that objects referenced by one container exist for the other.
      // Operations such as deep copying a sub-tree would become a lot more expensive.
      throw new Error('Containers to be merged must all come from the same repo');
    }

    if (
      a.config.type !== b.config.type || a.config.type !== base.config.type ||
      a.config.typeVersion !== b.config.typeVersion || a.config.typeVersion !== base.config.typeVersion
    ) {
      throw new Error(`Mismatched container types / versions: ${JSON.stringify({ a: a.config, b: b.config, base: base.config })}`);
    }

    for (const merger of this.mergers) {
      const result = await merger(a, b, base);
      if (result !== undefined) {
        return result;
      }
    }

    throw new Error(`No merger for containers with configs ${JSON.stringify({ a: a.config, b: b.config, base: base.config })}`);
  }
}

export function defaultForgContainerMerger(): ForgContainerMerger {
  const factory = new ForgContainerMerger();
  factory.addMerger(fileSystemContainerMerger);

  return factory;
}
