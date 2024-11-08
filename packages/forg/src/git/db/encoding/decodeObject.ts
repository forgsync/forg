import { decodePerson } from './person';
import { Hash, Person, Type } from '../model';
import { GitObject, BlobObject, TreeObject, CommitObject, TagObject, TreeBody, CommitBody, TagBody } from '../objects';
import { decode, fromDec, fromOct, unpackHash } from './util';

export default function decodeObject(buffer: Uint8Array): GitObject {
  const space = buffer.indexOf(0x20);
  if (space < 0) throw new Error('Invalid git object buffer');
  const nil = buffer.indexOf(0x00, space);
  if (nil < 0) throw new Error('Invalid git object buffer');
  const body = buffer.subarray(nil + 1);
  const size = fromDec(buffer, space + 1, nil);
  if (size !== body.length) throw new Error('Invalid body length.');
  const type = decode(buffer, 0, space);
  switch (type) {
    case Type.blob:
      return decodeBlob(body);
    case Type.tree:
      return decodeTree(body);
    case Type.commit:
      return decodeCommit(body);
    case Type.tag:
      return decodeTag(body);
    default:
      throw new Error('Unknown type');
  }
}

function decodeBlob(body: Uint8Array): BlobObject {
  return {
    type: Type.blob,
    body,
  };
}

function decodeTree(body: Uint8Array): TreeObject {
  let i = 0;
  const length = body.length;
  const tree: TreeBody = {};
  while (i < length) {
    let start = i;
    i = body.indexOf(0x20, start);
    if (i < 0) throw new SyntaxError('Missing space');
    const mode = fromOct(body, start, i++);
    start = i;
    i = body.indexOf(0x00, start);
    const name = decode(body, start, i++);
    const hash = unpackHash(body, i, (i += 20));
    tree[name] = {
      mode: mode,
      hash: hash,
    };
  }

  return {
    type: Type.tree,
    body: tree,
  };
}

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

function decodeCommit(body: Uint8Array): CommitObject {
  let i = 0;
  const parents: Hash[] = [];
  const commit: Writeable<CommitBody> = {
    tree: '',
    parents: parents,
    author: nullPerson(),
    committer: nullPerson(),
    message: '',
  };
  while (body[i] !== 0x0a) {
    let start = i;
    i = body.indexOf(0x20, start);
    if (i < 0) throw new SyntaxError('Missing space');
    const key = decode(body, start, i++);
    start = i;
    i = body.indexOf(0x0a, start);
    if (i < 0) throw new SyntaxError('Missing linefeed');
    let value = decode(body, start, i++);
    if (key === 'parent') {
      parents.push(value);
    } else if (key === 'author' || key === 'committer') {
      commit[key] = decodePerson(value);
    } else if (key === 'tree') {
      commit[key] = value;
    }
  }
  i++;
  commit.message = decode(body, i, body.length);
  return {
    type: Type.commit,
    body: commit,
  };
}

function decodeTag(body: Uint8Array): TagObject {
  let i = 0;
  const tag: Writeable<TagBody> = {
    object: '',
    type: '',
    tag: '',
    tagger: nullPerson(),
    message: '',
  };

  while (body[i] !== 0x0a) {
    let start = i;
    i = body.indexOf(0x20, start);
    if (i < 0) throw new SyntaxError('Missing space');
    const key = decode(body, start, i++);
    start = i;
    i = body.indexOf(0x0a, start);
    if (i < 0) throw new SyntaxError('Missing linefeed');
    let value = decode(body, start, i++);
    if (key === 'tagger') {
      const tagger = decodePerson(value);
      tag.tagger = tagger;
    }
    if (key === 'object' || key === 'type' || key === 'tag') {
      tag[key] = value;
    }
  }
  i++;
  tag.message = decode(body, i, body.length);
  return {
    type: Type.tag,
    body: tag,
  };
}

function nullPerson(): Person {
  return { name: '', email: '', date: { seconds: 0, offset: 0 } };
}
