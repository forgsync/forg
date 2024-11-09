import { decodeConfig } from './config';

const encoder = new TextEncoder();
describe('config', () => {
  test('decodeConfig', () => {
    const binary = encoder.encode([
      '# This is a comment',
      '[section1]',
      '\tvar1=1',
      '',
      '[section2] # this has a comment',
      '\tvar2 = "quoted value with \\" double-quotes and backslash \\\\ and weird \\escape inside"',
      '[section2 "sub-section.3"]',
      '   var3   =\t  some value  \n'
    ].join('\n'));

    expect(Array.from(decodeConfig(binary))).toEqual<[name: string, value: string][]>([
      ['section1.var1', '1'],
      ['section2.var2', 'quoted value with " double-quotes and backslash \\ and weird escape inside'],
      ['section2.sub-section.3.var3', 'some value'],
    ]);
  });
});
