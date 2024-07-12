import { Path } from "./Path";

describe('Path', () => {
  test('root', () => {
    for (const input of ['', '/']) {
      const path = new Path(input);
      expect(path.value).toBe('');
      expect(path.segments).toEqual([]);
      expect(path.isRoot).toBe(true);
    }
  });

  test('Root (slash)', () => {
    const path = new Path('/');
    expect(path.value).toBe('');
    expect(path.segments).toEqual([]);
    expect(path.isRoot).toBe(true);
  });

  test('Single segment', () => {
    for (const input of ['abc', '/abc', 'abc/']) {
      const path = new Path(input);
      expect(path.value).toBe('abc');
      expect(path.segments).toEqual(['abc']);
      expect(path.isRoot).toBe(false);
    }
  });

  test('Two segments', () => {
    for (const input of ['abc/d', '/abc/d', 'abc/d/']) {
      const path = new Path(input);
      expect(path.value).toBe('abc/d');
      expect(path.segments).toEqual(['abc', 'd']);
      expect(path.isRoot).toBe(false);
    }
  });

  test('isParentOf', () => {
    expect(new Path('a/b/c').isParentOf(new Path('a/b/c/d/e/f'))).toBe(true);
    expect(new Path('a/b/c').isParentOf(new Path('a/b/c/d'))).toBe(true);
    expect(new Path('a/b/c').isParentOf(new Path('a/b/c'))).toBe(false);
    expect(new Path('a/b/c').isParentOf(new Path('a/b'))).toBe(false);
    expect(new Path('a/b/c').isParentOf(new Path('a'))).toBe(false);
    expect(new Path('a/b/c').isParentOf(new Path(''))).toBe(false);
    expect(new Path('a/b/c').isParentOf(new Path('a/c/c/d/e'))).toBe(false);
    expect(new Path('a/b/c').isParentOf(new Path('b/b/c/d/e'))).toBe(false);
    expect(new Path('').isParentOf(new Path('a'))).toBe(true);
    expect(new Path('').isParentOf(new Path('a/b'))).toBe(true);
    expect(new Path('').isParentOf(new Path(''))).toBe(false);
  });

  test('isImmediateParentOf', () => {
    expect(new Path('a/b/c').isImmediateParentOf(new Path('a/b/c/d/e/f'))).toBe(false);
    expect(new Path('a/b/c').isImmediateParentOf(new Path('a/b/c/d'))).toBe(true);
    expect(new Path('a/b/c').isImmediateParentOf(new Path('a/b/c'))).toBe(false);
    expect(new Path('a/b/c').isImmediateParentOf(new Path('a/b'))).toBe(false);
    expect(new Path('a/b/c').isImmediateParentOf(new Path('a'))).toBe(false);
    expect(new Path('a/b/c').isImmediateParentOf(new Path(''))).toBe(false);
    expect(new Path('a/b/c').isImmediateParentOf(new Path('a/c/c/d/e'))).toBe(false);
    expect(new Path('a/b/c').isImmediateParentOf(new Path('b/b/c/d/e'))).toBe(false);
    expect(new Path('').isImmediateParentOf(new Path('a'))).toBe(true);
    expect(new Path('').isImmediateParentOf(new Path('a/b'))).toBe(false);
    expect(new Path('').isImmediateParentOf(new Path(''))).toBe(false);
  });

  test('rejects suspicious', () => {
    for (const input of ['//', '/a//b', '/a\\b/c', 'a/b\tc/d']) {
      expect(() => new Path(input)).toThrow();
    }
  });
});