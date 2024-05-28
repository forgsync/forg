export interface ISimpleFS {
  list(path: string): Promise<string[] | undefined>;
  read(path: string): Promise<Uint8Array | undefined>;
  write(path: string, contents: Uint8Array): Promise<void>;
  delete(path: string): Promise<void>;
}
