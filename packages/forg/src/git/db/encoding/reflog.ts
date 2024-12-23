import { ReflogEntry } from '../model';
import { decodePerson, encodePerson } from './person';
import { decode, validateHash } from './util';

export function encodeReflog(reflog: ReflogEntry[]) {
  return reflog.map((entry) => encodeReflogEntry(entry)).join('');
}

const NULL_COMMIT_ID = '0'.repeat(40);
function encodeReflogEntry(entry: ReflogEntry) {
  if (entry.previousCommit !== undefined && !validateHash(entry.previousCommit)) {
    throw new Error(`Invalid $.previousCommit ${entry.previousCommit}`);
  }

  if (!validateHash(entry.newCommit)) {
    throw new Error(`Invalid $.newCommit ${entry.newCommit}`);
  }

  const descriptionLineBreak = entry.description.indexOf('\n');
  const firstLine = descriptionLineBreak >= 0 ? entry.description.substring(0, descriptionLineBreak) : entry.description;
  return `${entry.previousCommit ?? NULL_COMMIT_ID} ${entry.newCommit} ${encodePerson(entry.person)}\t${firstLine}\n`;
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
    if (!validateHash(previousCommit)) {
      throw new Error(`Invalid previous commit hash in reflog: ${previousCommit}`);
    }

    i = nextDelimiter + 1;
    nextDelimiter = binary.indexOf(0x20, i); // SP
    if (nextDelimiter < 0 || nextDelimiter >= lineEnd) {
      throw new Error(`Expected space after position ${i}`);
    }
    const newCommit = decode(binary, i, nextDelimiter);
    if (!validateHash(newCommit)) {
      throw new Error(`Invalid new commit hash in reflog: ${newCommit}`);
    }

    i = nextDelimiter + 1;
    nextDelimiter = binary.indexOf(0x09, i); // TAB
    if (nextDelimiter < 0 || nextDelimiter >= lineEnd) {
      throw new Error(`Expected TAB after position ${i}`);
    }
    const person = decodePerson(decode(binary, i, nextDelimiter));

    i = nextDelimiter + 1;
    const description = decode(binary, i, lineEnd);

    results.push({
      previousCommit: previousCommit === NULL_COMMIT_ID ? undefined : previousCommit,
      newCommit,
      person,
      description,
    });

    i = lineEnd + 1;
  }

  return results;
}
