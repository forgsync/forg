const SP = 0x20;
const TAB = 0x09;
const OPEN_BRACKET = '['.charCodeAt(0);
const CLOSE_BRACKET = ']'.charCodeAt(0);
const DOUBLE_QUOTE = '"'.charCodeAt(0);
const BACKSLASH = '\\'.charCodeAt(0);
const DOT = '.'.charCodeAt(0);
const HYPHEN = '-'.charCodeAt(0);
const UPPERCASE_A = 'A'.charCodeAt(0);
const UPPERCASE_Z = 'Z'.charCodeAt(0);
const LOWERCASE_A = 'a'.charCodeAt(0);
const LOWERCASE_Z = 'z'.charCodeAt(0);
const NUM_0 = '0'.charCodeAt(0);
const NUM_9 = '9'.charCodeAt(0);
const POUND = '#'.charCodeAt(0);
const SEMICOLON = ';'.charCodeAt(0);
const CR = '\r'.charCodeAt(0);
const LF = '\n'.charCodeAt(0);
const EQUAL = '='.charCodeAt(0);
const EOF = -1;

export function decodeConfig(binary: Uint8Array): Map<string, string> {
  const result = new Map<string, string>();

  let curSection: string = '';
  let i = 0;
  let lineCounter = 1;
  let columnCounter = 1;

  try {
    while (i < binary.length) {
      parseLine();
      lineCounter++;
      columnCounter = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
    throw new Error(`Parsing failed at index ${i} (${lineCounter}:${columnCounter}): ${message}.`);
  }

  function peek() {
    return i < binary.length ? binary[i] : EOF;
  }

  function pop() {
    if (i >= binary.length) {
      throw new Error('Unexpected EOF');
    }

    columnCounter++;
    return binary[i++];
  }

  function parseLine() {
    consumeWhitespace();

    const c = peek();

    if (c === POUND || c === SEMICOLON || c === CR || c === LF || c === EOF) {
      // Nothing...
    }
    else if (c === OPEN_BRACKET) {
      curSection = parseSection();
    } else {
      const [name, value] = parseVariable();
      const fullName = `${curSection}.${name}`;
      if (result.has(fullName)) {
        throw new Error(`Reassignment of variable ${fullName}`);
      }
      result.set(fullName, value);
    }

    consumeLineTrailer();
  }

  function consumeWhitespace() {
    while (true) {
      const p = peek();
      if (p === SP || p === TAB) {
        pop();
      }
      else {
        break;
      }
    }
  }

  function parseSection(): string {
    consumeOne(OPEN_BRACKET);
    const sectionName = parseSectionName();
    let subSectionName: string | undefined = undefined;
    if (peek() === SP) {
      pop();
      subSectionName = parseSubSectionName();
    }

    consumeOne(CLOSE_BRACKET);

    return subSectionName !== undefined ? `${sectionName}.${subSectionName}` : sectionName;
  }

  function parseSectionName(): string {
    let value = '';
    do {
      let p = peek();
      if (p === SP || p === CLOSE_BRACKET) {
        break;
      }
      if ((p >= UPPERCASE_A && p <= UPPERCASE_Z) ||
        (p >= LOWERCASE_A && p <= LOWERCASE_Z) ||
        (p >= NUM_0 && p <= NUM_9) ||
        p === HYPHEN ||
        p === DOT) {
        value += String.fromCharCode(p);
        pop();
      }
      else {
        throw new Error(`Expected alphanumeric, hyphen, dot, space, or close-bracket, found ${p}`);
      }
    } while (true);

    return value;
  }

  function parseSubSectionName(): string {
    return parseQuotedValue();
  }

  function parseQuotedValue(): string {
    consumeOne(DOUBLE_QUOTE);

    let value = '';
    do {
      let p = peek();
      if (p === DOUBLE_QUOTE || p === EOF) {
        break;
      }
      if (p === BACKSLASH) {
        pop();
        p = pop();
        switch (p) {
          case DOUBLE_QUOTE: value += '"'; break;
          case BACKSLASH: value += '\\'; break;
          default: value += String.fromCharCode(p); break;
        }
      } else {
        value += String.fromCharCode(p);
        pop();
      }
    } while (true);

    consumeOne(DOUBLE_QUOTE);

    return value;
  }

  function parseVariable(): [name: string, value: string] {
    const name = parseVariableName();
    consumeWhitespace();
    consumeOne(EQUAL);
    consumeWhitespace();
    const value = parseValueOrQuotedValue();

    return [name, value];
  }

  function parseVariableName() {
    let value = '';
    do {
      let p = peek();
      if (p === SP || p === TAB || p === EQUAL) {
        break;
      }
      if ((p >= UPPERCASE_A && p <= UPPERCASE_Z) ||
        (p >= LOWERCASE_A && p <= LOWERCASE_Z) ||
        (p >= NUM_0 && p <= NUM_9) ||
        p === HYPHEN) {
        value += String.fromCharCode(p);
        pop();
      }
      else {
        throw new Error(`Expected alphanumeric, hyphen, dot, or close-bracket, found ${p}`);
      }
    } while (true);

    return value;
  }

  function parseValueOrQuotedValue(): string {
    const p = peek();
    if (p === DOUBLE_QUOTE) {
      return parseQuotedValue();
    }
    else {
      return parseUnquotedValue();
    }
  }

  function parseUnquotedValue(): string {
    let value = '';
    while (true) {
      const p = peek();
      if (p === CR || p === LF || p === POUND || p === SEMICOLON || p === EOF) {
        break;
      }
      value += String.fromCharCode(p);
      pop();
    }

    return value.trim();
  }

  function consumeUntilEndOfLine() {
    // Consume all characters that aren't CR or LF
    while (true) {
      const p = peek();
      if (p === LF || p === CR || p === EOF) {
        break;
      }

      pop();
    }
  }

  function consumeLineTrailer() {
    consumeWhitespace();
    let p = peek();
    if (p === POUND || p === SEMICOLON) {
      consumeUntilEndOfLine();
    }

    consumeOneOptional(CR);
    consumeOneOf(LF, EOF);
  }

  function consumeOneOptional(charCode: number) {
    const p = peek();
    if (p === charCode) {
      pop();
    }
  }

  function consumeOne(charCode: number) {
    const p = peek();
    if (p !== charCode) {
      throw new Error(`Unexpected byte ${p} ('${String.fromCharCode(p)}'), expected ${charCode} ('${String.fromCharCode(charCode)}')`)
    }
    pop();
  }

  function consumeOneOf(...charCodes: number[]) {
    const p = peek();
    if (!charCodes.includes(p)) {
      throw new Error(`Unexpected byte ${p}, expected one of ${charCodes.map(c => `${c} ('${String.fromCharCode(c)}')`).join(', ')}`)
    }
    if (p !== EOF) {
      pop();
    }
  }

  return result;
}
