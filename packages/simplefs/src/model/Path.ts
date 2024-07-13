export class Path {
  private readonly _value: string;
  private readonly _segments: string[];

  /**
   * The sanitized path value. This never starts with a slash
   */
  get value() {
    return this._value;
  }
  get segments() {
    return [...this._segments];
  }
  get isRoot() {
    return this._segments.length === 0;
  }

  constructor(path: string) {
    if (path === '//') {
      throw new Error(`Invalid path '${path}'`);
    }

    if (path.startsWith('/')) {
      path = path.substring(1);
    }

    if (path.endsWith('/')) {
      path = path.substring(0, path.length - 1);
    }

    this._value = path;
    this._segments = path === '' ? [] : path.split('/');
    validateSegments(this._segments);
  }

  getParent(): Path {
    if (this._segments.length === 0) {
      throw new Error(`Unable to get parent of the root`);
    }

    return new Path(this._segments.slice(0, this._segments.length - 1).join('/'));
  }

  startsWith(path: Path): boolean {
    if (this._segments.length < path._segments.length) {
      return false;
    }

    for (let i = 0; i < path._segments.length; i++) {
      if (this._segments[i] !== path._segments[i]) {
        return false;
      }
    }

    return true;
  }

  isParentOf(path: Path): boolean {
    return path.startsWith(this) && path.value !== this.value;
  }

  isImmediateParentOf(path: Path): boolean {
    if (this._segments.length !== path._segments.length - 1) {
      return false;
    }

    for (let i = 0; i < this._segments.length; i++) {
      if (this._segments[i] !== path._segments[i]) {
        return false;
      }
    }

    return true;
  }

  static join(a: Path, b: Path): Path {
    if (b.value === '') {
      return a;
    }

    return new Path(a.value + '/' + b.value);
  }
}

const validSegmentRegex = /^[a-zA-Z0-9+=|~()<>{}?,.!;:'"\[\]&%$#@^*_ -]+$/;
function validateSegments(segments: string[]) {
  for (const segment of segments) {
    if (segment === '') {
      throw new Error("Path contains an empty segment ('//')");
    }

    if (segment === '.' || segment === '..') {
      // Do not even try to support relative paths. Explode immediately.
      throw new Error(`Relative paths are not supported. Found segment '${segment}'`);
    }

    if (!segment.match(validSegmentRegex)) {
      throw new Error(`Invalid character in segment '${segment}'`);
    }
  }
}
