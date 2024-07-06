import { ReflogEntry } from "../model";
import { decodePerson, encodePerson } from "./person";
import { decode, sanitizeString } from "./util";

export function encodeReflog(reflog: ReflogEntry[]) {
  return reflog.map(entry => encodeReflogEntry(entry)).join();
}

function encodeReflogEntry(entry: ReflogEntry) {
  return `${entry.previousCommit} ${entry.newCommit} ${encodePerson(entry.person)}\t${sanitizeString(entry.description)}\n`;
}

export function decodeReflog(binary: Uint8Array): ReflogEntry[] {
  const results: ReflogEntry[] = [];

  let i = 0;
  while (i < binary.length) {
    // Format:
    // <previousCommit> SP <newCommit> SP <person> TAB <description> LF
    const lineEnd = binary.indexOf(0x0a, i);

    let nextDelimiter = binary.indexOf(0x20, i); // SP
    if (nextDelimiter < 0 || nextDelimiter >= lineEnd) {
      throw new Error(`Expected space after position ${i}`);
    }
    const previousCommit = decode(binary, i, nextDelimiter);

    i = nextDelimiter + 1;
    nextDelimiter = binary.indexOf(0x20, i); // SP
    if (nextDelimiter < 0 || nextDelimiter >= lineEnd) {
      throw new Error(`Expected space after position ${i}`);
    }
    const newCommit = decode(binary, i, nextDelimiter);

    i = nextDelimiter + 1;
    nextDelimiter = binary.indexOf(0x09, i); // TAB
    if (nextDelimiter < 0 || nextDelimiter >= lineEnd) {
      throw new Error(`Expected TAB after position ${i}`);
    }
    const person = decodePerson(decode(binary, i, nextDelimiter));

    i = nextDelimiter + 1;
    const description = decode(binary, i, lineEnd);

    results.push({
      previousCommit,
      newCommit,
      person,
      description,
    });

    i = lineEnd + 1;
  }

  return results;
}
