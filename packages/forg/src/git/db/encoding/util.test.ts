import { isValidHash, validateHash } from './util';

describe('util', () => {
  test.each([
    '0000000000000000000000000000000000000000',
    'eaef5b6f452335fad4dd280a113d81e82a3acaca',
  ])('isValidHash good %p', (hash: string) => {
    expect(isValidHash(hash)).toBe(true);
    validateHash(hash);
  });

  test.each([
    '000000000000000000000000000000000000000',
    '00000000000000000000000000000000000000000',
    ' 0000000000000000000000000000000000000000',
    '0000000000000000000000000000000000000000 ',
    '0000000000000000000000000000000000000000\n',
    '00000000000000000000000 00000000000000000',
    '000000000000000000000000000000000000000z',
    '000000000000000000000000000000000000000á',
    'eaef5b6f452335fad-4dd280a113d81e82a3acaca',
    '',
  ])('isValidHash bad %p', (hash: string) => {
    expect(isValidHash(hash)).toBe(false);
    expect(() => validateHash(hash)).toThrow(/Invalid hash/);
  });

  test('validateHash', () => {
    expect(() => validateHash('invalid')).toThrow("Invalid hash 'invalid'");
  });

  test('validateHash with details', () => {
    expect(() => validateHash('invalid', 'some use case')).toThrow("Invalid hash 'invalid' (some use case)");
  });
});
