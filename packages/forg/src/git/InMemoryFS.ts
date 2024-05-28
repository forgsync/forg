import { ISimpleFS } from "./ISimpleFS";

export class InMemoryFS implements ISimpleFS {
    list(_path: string): Promise<string[] | undefined> {
        throw new Error("Method not implemented.");
    }
    read(_path: string): Promise<Uint8Array | undefined> {
        throw new Error("Method not implemented.");
    }
    write(_path: string, _contents: Uint8Array): Promise<void> {
        throw new Error("Method not implemented.");
    }
    delete(_path: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
}
