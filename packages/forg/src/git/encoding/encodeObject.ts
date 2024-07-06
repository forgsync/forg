import { encodePerson } from './person';
import { Mode, Type } from '../model';
import {
  CommitBody, GitObject,
  TagBody, TreeBody
} from '../objects';
import { NEWLINE, concat, encode, flatten, packHash } from './util';


export default function encodeObject(object: GitObject): Uint8Array {
  const bytes = getBytes(object);
  return concat(encode(`${object.type} ${bytes.length}\0`), bytes);
}

export function getBytes(object: GitObject): Uint8Array {
  switch (object.type) {
    case Type.blob:
      return encodeBlob(object.body);
    case Type.tree:
      return encodeTree(object.body);
    case Type.commit:
      return encodeCommit(object.body);
    case Type.tag:
      return encodeTag(object.body);
    default:
      throw new Error(`Unknown object type`);
  }
}

export function textToBlob(text: string) {
  return encode(text);
}

export function encodeBlob(body: Uint8Array) {
  return body;
}

export function treeSort(a: { name: string, mode: Mode }, b: { name: string, mode: Mode }) {
  const aa = (a.mode === Mode.tree) ? `${a.name}/` : a.name;
  const bb = (b.mode === Mode.tree) ? `${b.name}/` : b.name;
  return aa > bb ? 1 : aa < bb ? -1 : 0;
}

export function encodeTree(body: TreeBody) {
  return concat(...flatten(Object.keys(body)
    .map(key => ({
      name: key,
      ...body[key]
    }))
    .sort(treeSort)
    .map(entry => [encode(`${entry.mode.toString(8)} ${entry.name}\0`), packHash(entry.hash)])));

}

export function encodeTag(body: TagBody) {
  return joinWithNewline(
    `object ${body.object}`,
    `type ${body.type}`,
    `tag ${body.tag}`,
    `tagger ${encodePerson(body.tagger)}`,
    '',
    body.message);
}

export function encodeCommit(body: CommitBody) {
  return joinWithNewline(
    `tree ${body.tree}`,
    ...body.parents.map(p => `parent ${p}`),
    `author ${encodePerson(body.author)}`,
    `committer ${encodePerson(body.committer)}`,
    '',
    body.message);
}

function joinWithNewline(...values: (string | Uint8Array)[]) {
  const size = values.map(x => x.length).reduce((a, b) => a + b, 0);
  let result = new Uint8Array(values.length - 1 + size);
  let offset = 0;
  for (const arr of values) {
    if (offset > 0) {
      result = maybeGrow(result, offset + 1);
      result.set([NEWLINE], offset++);
    }
    if (typeof (arr) === 'string') {
      const bytes = encode(arr);
      result = maybeGrow(result, offset + bytes.length);
      result.set(bytes, offset);
    } else {
      result = maybeGrow(result, offset + arr.length);
      result.set(arr, offset);
    }
    offset += arr.length;
  }
  return result;
}

function maybeGrow(array: Uint8Array, newSize: number) {
  if (newSize < array.length) return array;
  return grow(array, newSize);
}

function grow(array: Uint8Array, size: number) {
  const newArray = new Uint8Array(size);
  newArray.set(array);
  return newArray;
}