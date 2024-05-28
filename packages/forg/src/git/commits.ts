import { Hash, Mode, ModeHash, Person, Type } from "./model";
import { saveObject } from "./objects";
import { IRepo } from "./Repo";

export type Folder = {
  readonly files?: {
    readonly [key: string]: File;
  }
  readonly folders?: {
    readonly [key: string]: Folder | ExistingFolder;
  }
}

export type ExistingFolder = Hash;

export type BinaryFile = {
  readonly isExecutable?: boolean
  readonly body: Uint8Array
}

export type ExistingFile = {
  readonly isExecutable?: boolean
  readonly hash: Hash
}

export type File = BinaryFile | ExistingFile;


export async function commit(repo: IRepo, ref: string, tree: Folder, message: string, author: Person, committer: Person = author): Promise<Hash> {
  const originalHash = await repo.getRef(ref);
  if (!originalHash) throw new Error(`Unknown ref ${ref}`);

  const treeHash = await saveTree(repo, tree);

  const hash = await saveObject(
    repo,
    {
      type: Type.commit,
      body: {
        author,
        committer,
        message,
        parents: [originalHash],
        tree: treeHash
      }
    });

  await repo.setRef(ref, hash);
  return hash;
}

export async function saveTree(repo: IRepo, folder: Folder | Hash): Promise<Hash> {
  if (typeof (folder) === 'string') return folder;

  const body: { [key: string]: ModeHash } = {};

  if (folder.folders) {
    for (const name of Object.keys(folder.folders)) {
      const hash = await saveTree(repo, folder.folders[name]);
      body[name] = { hash, mode: Mode.tree };
    }
  }

  if (folder.files) {
    for (const name of Object.keys(folder.files)) {
      const hash = await saveFile(repo, folder.files[name]);
      body[name] = { hash, mode: folder.files[name].isExecutable ? Mode.exec : Mode.file };
    }
  }

  return await saveObject(
    repo,
    {
      type: Type.tree,
      body: body
    });
}

async function saveFile(repo: IRepo, file: File): Promise<Hash> {
  if (isHash(file)) return file.hash;
  return await saveObject(repo, { type: Type.blob, body: file.body });
}

function isHash(file: File): file is ExistingFile {
  return 'hash' in file;
}
