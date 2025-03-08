import { ISimpleFS } from "@forgsync/simplefs";

export abstract class ForgContainer {
  constructor(
    readonly root: ISimpleFS,
  ) { }

  abstract reconcile(other: ForgContainer): void;
}
