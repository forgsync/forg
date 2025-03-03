import { Path } from './Path';

export interface ISimpleFS {
  fileExists(path: Path): Promise<boolean>;
  read(path: Path): Promise<Uint8Array>;
  write(path: Path, data: Uint8Array): Promise<void>;
  deleteFile(path: Path): Promise<void>;

  directoryExists(path: Path): Promise<boolean>;
  list(path: Path, options?: ListOptions): Promise<ListEntry[]>;
  createDirectory(path: Path): Promise<void>;
  deleteDirectory(path: Path): Promise<void>;

  /**
   * Returns a new ISimpleFS that has the provided path as its root.
   */
  chroot(path: Path): Promise<ISimpleFS>;
}

export interface ListOptions {
  recursive?: boolean;
}

export interface ListEntry {
  path: Path;
  kind: 'file' | 'dir';
}
