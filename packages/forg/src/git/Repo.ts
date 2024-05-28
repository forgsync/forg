import * as pako from 'pako';

import { Hash } from './model';
import { decode, encode } from './utils';
import { ISimpleFS } from "./ISimpleFS";


export interface IRepo {
  listRefs(): Promise<string[]>;
  getRef(ref: string): Promise<Hash | undefined>;
  setRef(ref: string, hash: Hash | undefined): Promise<void>;
  saveRawObject(hash: Hash, raw: Uint8Array): Promise<void>;
  loadRawObject(hash: Hash): Promise<Uint8Array | undefined>;
  hasObject(hash: Hash): Promise<boolean>;
  saveMetadata(name: string, value: Uint8Array | undefined): Promise<void>;
  loadMetadata(name: string): Promise<Uint8Array | undefined>;
}

export class Repo implements IRepo {
  private readonly _fs: ISimpleFS;

  constructor(fs: ISimpleFS) {
    this._fs = fs;
  }

  async listRefs(): Promise<string[]> {
    throw new Error("Method not implemented.");
  }

  async getRef(ref: string): Promise<string | undefined> {
    const rawContent = await this._fs.read(ref);
    if (rawContent) {
      const content = decode(rawContent);
      return content.trim();
    }

    return undefined;
  }

  async setRef(ref: string, hash: string | undefined): Promise<void> {
    if (hash !== undefined) {
      const rawContent = `${hash}\n`;
      const content = encode(rawContent);
      await this._fs.write(ref, content);
    }
    else {
      await this._fs.delete(ref);
    }
  }

  async saveRawObject(hash: string, raw: Uint8Array): Promise<void> {
    const compressed = pako.deflate(raw);
    const path = Repo._ObjectPath(hash);
    await this._fs.write(path, compressed);
  }

  async loadRawObject(hash: string): Promise<Uint8Array | undefined> {
    const path = Repo._ObjectPath(hash);
    const compressed = await this._fs.read(path);
    return compressed ? pako.inflate(compressed) : undefined;
  }

  async hasObject(hash: string): Promise<boolean> {
    const content = await this._fs.read(Repo._ObjectPath(hash));
    return content !== undefined;
  }

  async saveMetadata(name: string, value: Uint8Array | undefined): Promise<void> {
    if (value !== undefined) {
      await this._fs.write(name, value);
    }
    else {
      await this._fs.delete(name);
    }
  }

  async loadMetadata(name: string): Promise<Uint8Array | undefined> {
    const content = await this._fs.read(name);
    return content;
  }

  private static _ObjectPath(hash: Hash) {
    return `objects/${hash.substring(0, 2)}/${hash.substring(2)}`;
  }
}
