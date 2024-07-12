import { Path } from "./Path";

export interface ISimpleFS {
  fileExists(path: Path): Promise<boolean>;
  directoryExists(path: Path): Promise<boolean>;
  read(path: Path): Promise<Uint8Array>;
  write(path: Path, data: Uint8Array): Promise<void>;
  deleteFile(path: Path): Promise<void>;
  deleteDirectory(path: Path): Promise<void>;
  list(path: Path): Promise<ListEntry[]>;
}

export interface ListEntry {
  path: Path;
  kind: 'file' | 'dir';
}
