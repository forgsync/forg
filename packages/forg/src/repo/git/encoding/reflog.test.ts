import { ReflogEntry } from '../model';
import { decodeReflog, encodeReflog } from './reflog';
import { dummyPerson } from '../../../__testHelpers__/dummyPerson';

const encoder = new TextEncoder();

describe('Encode', () => {
  test('empty', () => {
    expect(encodeReflog([])).toBe('');
  });

  test('one', () => {
    expect(
      encodeReflog([
        {
          previousCommit: '0000000000000000000000000000000000000000',
          newCommit: 'eaef5b6f452335fad4dd280a113d81e82a3acaca',
          person: dummyPerson(),
          description: 'something\nweird',
        },
      ]),
    ).toBe(
      '0000000000000000000000000000000000000000 eaef5b6f452335fad4dd280a113d81e82a3acaca Test Name <test@example.com> 2272247100 -0300\tsomething\n',
    );
  });

  test('two', () => {
    expect(
      encodeReflog([
        {
          previousCommit: '0000000000000000000000000000000000000000',
          newCommit: '0000000000000000000000000000000000000001',
          person: dummyPerson(),
          description: 'description 1',
        },
        {
          previousCommit: '0000000000000000000000000000000000000001',
          newCommit: '0000000000000000000000000000000000000002',
          person: dummyPerson(),
          description: 'description 2',
        },
      ]),
    ).toBe(
      '0000000000000000000000000000000000000000 0000000000000000000000000000000000000001 Test Name <test@example.com> 2272247100 -0300\tdescription 1\n' +
        '0000000000000000000000000000000000000001 0000000000000000000000000000000000000002 Test Name <test@example.com> 2272247100 -0300\tdescription 2\n',
    );
  });
});

describe('Decode', () => {
  test('empty', () => {
    const input = encoder.encode('');
    const actual = decodeReflog(input);
    expect(actual).toEqual<ReflogEntry[]>([]);
  });

  test('one', () => {
    const input = encoder.encode(
      '0000000000000000000000000000000000000000 eaef5b6f452335fad4dd280a113d81e82a3acaca Test Name <test@example.com> 2272247100 -0300\tsomething weird\n',
    );
    const actual = decodeReflog(input);
    expect(actual).toEqual<ReflogEntry[]>([
      {
        previousCommit: '0000000000000000000000000000000000000000',
        newCommit: 'eaef5b6f452335fad4dd280a113d81e82a3acaca',
        person: dummyPerson(),
        description: 'something weird',
      },
    ]);
  });

  test('two', () => {
    const input = encoder.encode(
      '0000000000000000000000000000000000000000 eaef5b6f452335fad4dd280a113d81e82a3acaca Test Name <test@example.com> 2272247100 -0300\tcommit (initial): Initial commit\n' +
        'eaef5b6f452335fad4dd280a113d81e82a3acaca 9254379c365d23429f0fff266834bdc853c35fe1 Test Name <test@example.com> 2272247100 -0300\tcommit: Added a.txt\n',
    );
    const actual = decodeReflog(input);
    expect(actual).toEqual<ReflogEntry[]>([
      {
        previousCommit: '0000000000000000000000000000000000000000',
        newCommit: 'eaef5b6f452335fad4dd280a113d81e82a3acaca',
        person: dummyPerson(),
        description: 'commit (initial): Initial commit',
      },
      {
        previousCommit: 'eaef5b6f452335fad4dd280a113d81e82a3acaca',
        newCommit: '9254379c365d23429f0fff266834bdc853c35fe1',
        person: dummyPerson(),
        description: 'commit: Added a.txt',
      },
    ]);
  });
});
