import { ListEntry } from '@forgsync/simplefs';
import { Mode, Type } from './model';

enum Mask {
  mask = 0o100000,
  blob = 0o140000,
  file = 0o160000,
}

export function isBlob(mode: number) {
  return (mode & Mask.blob) === Mask.mask;
}

export function isFile(mode: number) {
  return (mode & Mask.file) === Mask.mask;
}

export function toType(mode: number) {
  if (mode === Mode.commit) return Type.commit;
  if (mode === Mode.tree) return Type.tree;
  if ((mode & Mask.blob) === Mask.mask) return Type.blob;
  return Type.unknown;
}

export function errorToString(error: any): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

/**
 * Can be used to sort strings for use in git trees.
 * Ideally we would sort byte-wise like memcmp, but this is close
 * (and any discrepancies shouldn't be catastrophic anyway, as long as the client makes no assumptions about existing tree sorting).
 */
export function gitStringComparer(a: string, b: string): number {
  return (a > b) ? 1 : (a < b) ? -1 : 0
}

export function gitFileEntryComparer(a: ListEntry, b: ListEntry): number {
  return gitStringComparer(a.path.value, b.path.value);
}
