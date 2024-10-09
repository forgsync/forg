import { tryParseForgHeadRef, tryParseForgRef, tryParseForgRemoteRef } from './tryParseForgRef';

describe('tryParseForgRef remote refs', () => {
  test.each([
    ['refs/remotes/client1/main', 'client1', 'main'],
    ['refs/remotes/client2/temp', 'client2', 'temp'],
    ['refs/remotes/a12-_aA / \"zn', 'a12-_aA ', ' \"zn'],
  ])('Parses \'%p\' successfully', (ref: string, expectedClientUuid: string, expectedBranchName: string) => {
    const refInfo = tryParseForgRef(ref);
    expect(refInfo).toBeDefined();
    if (refInfo?.kind !== 'remote') {
      fail();
    }
    expect(refInfo.client.uuid).toBe(expectedClientUuid);
    expect(refInfo!.branchName).toBe(expectedBranchName);

    const refInfo2 = tryParseForgRemoteRef(ref);
    expect(refInfo2).toEqual(refInfo);
  });

  test.each([
    'refs/remotes',
    'refs/remotes/',
    'refs/remotes/missingLevel',
    'refs/remotes/client1/main/unexpectedLeaf',
    'Refs/remotes/client1/main',
    'refs/Remotes/client1/main',
    ' refs/remotes/client1/main',
  ])('Rejects invalid \'%p\'', (ref: string) => {
    const refInfo = tryParseForgRef(ref);
    expect(refInfo).toBeUndefined();

    const refInfo2 = tryParseForgRemoteRef(ref);
    expect(refInfo2).toBeUndefined();
  });
});

describe('tryParseForgRef head refs', () => {
  test.each([
    ['refs/heads/main', 'main'],
    ['refs/heads/temp', 'temp'],
    ['refs/heads/ \"zn', ' \"zn'],
  ])('Parses \'%p\' successfully', (ref: string, expectedBranchName: string) => {
    const refInfo = tryParseForgRef(ref);
    expect(refInfo).toBeDefined();
    if (refInfo?.kind !== 'head') {
      fail();
    }
    expect(refInfo!.branchName).toBe(expectedBranchName);

    const refInfo2 = tryParseForgHeadRef(ref);
    expect(refInfo2).toEqual(refInfo);
  });

  test.each([
    'refs/heads',
    'refs/heads/',
    'refs/heads/main/unexpectedLeaf',
    'refs/heads/main/',
    'Refs/heads/main',
    'refs/Heads/main',
    ' refs/heads/main',
  ])('Rejects invalid \'%p\'', (ref: string) => {
    const refInfo = tryParseForgRef(ref);
    expect(refInfo).toBeUndefined();

    const refInfo2 = tryParseForgHeadRef(ref);
    expect(refInfo2).toBeUndefined();
  });
});
