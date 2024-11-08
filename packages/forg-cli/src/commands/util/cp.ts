import { ISimpleFS, Path } from '@forgsync/simplefs';

export async function recursiveCopy(from: ISimpleFS, to: ISimpleFS, path: Path) {
  for (const entry of await from.list(path)) {
    if (entry.kind === 'file') {
      await to.write(entry.path, await from.read(entry.path));
    } else {
      await recursiveCopy(from, to, entry.path);
    }
  }
}
