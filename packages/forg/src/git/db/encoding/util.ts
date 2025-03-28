const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const NEWLINE = '\n'.charCodeAt(0);

export function encode(text: string) {
  return encoder.encode(text);
}

export function flatten<T>(items: T[][]) {
  return items.reduce((result, list) => result.concat(list), []);
}

export function decode(binary: Uint8Array, start = 0, end = binary.length) {
  if (start !== 0 || end !== binary.length) {
    return decoder.decode(binary.subarray(start, end));
  } else {
    return decoder.decode(binary);
  }
}

export function concat(...arrays: (Uint8Array | number[])[]) {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

export function fromHexChar(val: number) {
  return val < 0x57 ? val - 0x30 : val - 0x57;
}

export function fromDec(buffer: Uint8Array, start: number, end: number) {
  let val = 0;
  while (start < end) {
    val = val * 10 + fromDecChar(buffer[start++]);
  }
  return val;
}

export function fromDecChar(val: number) {
  return val - 0x30;
}

export function fromOct(buffer: Uint8Array, start: number, end: number) {
  let val = 0;
  while (start < end) {
    val = (val << 3) + fromDecChar(buffer[start++]);
  }
  return val;
}

export function packHash(hex: string) {
  validateHash(hex);

  var raw = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length;) {
    raw[i / 2] = (fromHexChar(hex.charCodeAt(i++)) << 4) | fromHexChar(hex.charCodeAt(i++));
  }
  return raw;
}

export function unpackHash(binary: Uint8Array, start = 0, end = binary.length) {
  if (end - start !== 20) {
    throw new Error(`Invalid hash length ${end - start}, expected 20`);
  }

  if (start < 0 || start >= binary.length || end > binary.length) {
    throw new Error(`Out of bounds: (${start}..${end}) and buffer length ${binary.length}`);
  }

  var hex = '';
  for (var i = start; i < end; i++) {
    const byte = binary[i];
    hex += String.fromCharCode(toHexChar(byte >> 4)) + String.fromCharCode(toHexChar(byte & 0xf));
  }
  return hex;
}

export function toHexChar(val: number) {
  return val < 10 ? val + 0x30 : val + 0x57;
}

export function sanitizeString(string: string) {
  return string.replace(/(?:^[\.,:;<>"']+|[\0\n\t<>]+|[\.,:;<>"']+$)/g, '');
}

const commitHashRegex = /^[0-9a-f]{40}$/;
export function isValidHash(hash: string) {
  return hash.match(commitHashRegex) !== null;
}

export function validateHash(hash: string, detail?: string) {
  if (!isValidHash(hash)) {
    const detailString = detail === undefined ? '' : ` (${detail})`;
    throw new Error(`Invalid hash '${hash}'${detailString}`);
  }
}
