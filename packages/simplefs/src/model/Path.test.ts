import { Path } from './Path';

describe('Path', () => {
  test.each(['', '/'])("'%p' is a valid root", (input: string) => {
    const path = new Path(input);
    expect(path.value).toBe('');
    expect(path.segments).toEqual([]);
    expect(path.isRoot).toBe(true);
  });

  test.each(['abc', '/abc', 'abc/'])("Single segment '%p'", (input: string) => {
    const path = new Path(input);
    expect(path.value).toBe('abc');
    expect(path.segments).toEqual(['abc']);
    expect(path.leafName).toBe('abc');
    expect(path.isRoot).toBe(false);
  });

  test.each(['ab c/d', '/ab c/d', 'ab c/d/'])("Two segments '%p'", (input: string) => {
    const path = new Path(input);
    expect(path.value).toBe('ab c/d');
    expect(path.segments).toEqual(['ab c', 'd']);
    expect(path.leafName).toBe('d');
    expect(path.isRoot).toBe(false);
  });

  test.each([
    ['a/b/c', 'a/b/c/d/e/f', true],
    ['a/b/c', 'a/b/c/d', true],
    ['a/b/c', 'a/b/c', false],
    ['a/b/c', 'a/b', false],
    ['a/b/c', 'a', false],
    ['a/b/c', '', false],
    ['a/b/c', 'a/c/c/d/e', false],
    ['a/b/c', 'b/b/c/d/e', false],
    ['', 'a', true],
    ['', 'a/b', true],
    ['', '', false],
  ])("'%p' isParentOf '%p' should be %p", (a: string, b: string, expected: boolean) => {
    expect(new Path(a).isParentOf(new Path(b))).toBe(expected);
  });

  test.each([
    ['a/b/c', 'a/b/c/d/e/f', false],
    ['a/b/c', 'a/b/c/d', true],
    ['a/b/c', 'a/b/c', false],
    ['a/b/c', 'a/b', false],
    ['a/b/c', 'a', false],
    ['a/b/c', '', false],
    ['a/b/c', 'a/c/c/d/e', false],
    ['a/b/c', 'b/b/c/d/e', false],
    ['', 'a', true],
    ['', 'a/b', false],
    ['', '', false],
  ])("'%p' isImmediateParentOf '%p' should be %p", (a: string, b: string, expected: boolean) => {
    expect(new Path(a).isImmediateParentOf(new Path(b))).toBe(expected);
  });

  test.each(['//', '///', '/a//b', '/a\\b/c', 'a/b\tc/d'])("Rejects suspicious '%p'", (input: string) => {
    expect(() => new Path(input)).toThrow();
  });

  test('getParent of root throws', () => {
    const root = new Path('');
    expect(() => root.getParent()).toThrow();
  });

  test('leafName of root throws', () => {
    const root = new Path('');
    expect(() => root.leafName).toThrow();
  });

  test.each([
    ['a', ''],
    ['a/b', 'a'],
    ['a/bcd/ef', 'a/bcd'],
  ])("'%p'.getParent() should be '%p'", (path: string, expected: string) => {
    expect(new Path(path).getParent().value).toBe(expected);
  });
});
