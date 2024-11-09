import { parseConfig } from './parseConfig';

const encoder = new TextEncoder();
describe('parseConfig', () => {
  test('example1', () => {
    const binary = encoder.encode([
      '# This is a comment',
      '[section1]',
      '\tvar1=1',
      '',
      '[section2] # this has a comment',
      '\tvar2 = "quoted value with \\" double-quotes and backslash \\\\ and weird \\escape inside \\0"',
      '[section2 "sub-section.3"]',
      '   var3   =\t  some value  \n'
    ].join('\n'));

    expect(Array.from(parseConfig(binary))).toEqual<[name: string, value: string[]][]>([
      ['section1.var1', ['1']],
      ['section2.var2', ['quoted value with " double-quotes and backslash \\ and weird escape inside 0']],
      ['section2.sub-section.3.var3', ['some value']],
    ]);
  });

  test('official example', () => {
    const binary = encoder.encode([
      '#',
      '# This is the config file, and',
      '# a \'#\' or \';\' character indicates',
      '# a comment',
      '#',
      '',
      '; core variables',
      '[core]',
      '\t; Don\'t trust file modes',
      '\tfilemode = false',
      '',
      '; Our diff algorithm',
      '[diff]',
      '\texternal = /usr/local/bin/diff-wrapper',
      '\trenames = true',
      '',
      '; Proxy settings',
      '[core]',
      '\tgitproxy=proxy-command for kernel.org',
      '\tgitproxy=default-proxy ; for all the rest',
      '',
      '; HTTP',
      '[http]',
      '\tsslVerify',
      '[http "https://weak.example.com"]',
      '\tsslVerify = false',
      '\tcookieFile = /tmp/cookie.txt',
    ].join('\n'));

    expect(Array.from(parseConfig(binary))).toEqual<[name: string, value: string[]][]>([
      ['core.filemode', ['false']],
      ['diff.external', ['/usr/local/bin/diff-wrapper']],
      ['diff.renames', ['true']],
      ['core.gitproxy', ['proxy-command for kernel.org', 'default-proxy']],
      ['http.sslVerify', ['true']],
      ['http.https://weak.example.com.sslVerify', ['false']],
      ['http.https://weak.example.com.cookieFile', ['/tmp/cookie.txt']],
    ]);
  });

  test.each<[string[], [string, string[]][]]>([
    [
      // empty
      [],
      []
    ], [
      // one empty line
      [''],
      []
    ], [
      // two empty lines
      ['', '',],
      []
    ],
    [
      // one whitespace line
      [' ',],
      []
    ],
    [
      // one whitespace line
      ['\t',],
      []
    ],
    [
      ['#hello',],
      []
    ],
    [
      ['#hello', '',],
      []
    ],
    [
      ['#hello\r',],
      []
    ],
    [
      ['#hello\r', '[core]', 'a=1'],
      [
        ['core.a', ['1']],
      ]
    ],
    [
      ['[core]', 'a=1'],
      [
        ['core.a', ['1']],
      ]
    ],
    [
      ['[core]', 'a=1', ''],
      [
        ['core.a', ['1']],
      ]
    ],
    [
      [
        '[core]',
        '  a=1',
        '[http "example.com"]',
        '[http "example.net"]',
        '[http "a-b.example.net"]',
        '  b-c= " a b "'
      ],
      [
        ['core.a', ['1']],
        ['http.a-b.example.net.b-c', [' a b ']],
      ]
    ],
  ])('valid cases', (input, expectedOutput) => {
    const allLines = input.join('\n');
    //console.log(allLines);
    const binary = encoder.encode(allLines);
    expect(Array.from(parseConfig(binary))).toEqual<[name: string, value: string[]][]>(expectedOutput);
  });

  test.each<[string[], RegExp]>([
    [
      ['abc=1'],
      /variable defined outside of a section: 'abc'/
    ],
    [
      [
        '[core]',
        '  a b=1',
      ],
      /Unexpected 'b', expected one of '\\n', EOF/
    ],
    [
      ['[core ]',],
      /Unexpected ']', expected '"'/
    ],
    [
      ['[core "abc" ]',],
      /Unexpected ' ', expected ']'/
    ],
    [
      [
        '[core "ab',
        'c"]',
        '  a=1'
      ],
      /Unexpected '\\n'/
    ],
    [
      ['[core'],
      /found EOF/
    ],
  ])('error cases', (input, errorMatcher) => {
    const allLines = input.join('\n');
    //console.log(allLines);
    const binary = encoder.encode(allLines);
    expect(() => parseConfig(binary)).toThrow(errorMatcher);
  });
});
