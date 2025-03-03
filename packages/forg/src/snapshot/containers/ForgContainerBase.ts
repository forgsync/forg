import { ISimpleFS } from "@forgsync/simplefs";

export abstract class ForgContainerBase {
  constructor(
    protected readonly _root: ISimpleFS,
  ) { }

  abstract reconcile(other: ForgContainerBase): void;
}

