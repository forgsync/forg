import { Hash } from '../model';
import { decode, encode, validateHash } from './util';

export function decodeRef(binary: Uint8Array): Hash {
  const hash = decode(binary).trim();
  validateHash(hash, 'ref');
  return hash;
}

export function encodeRef(hash: Hash): Uint8Array {
  validateHash(hash, 'ref');
  const rawContent = `${hash}\n`;
  return encode(rawContent);
}
