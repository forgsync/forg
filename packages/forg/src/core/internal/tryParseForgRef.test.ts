import tryParseForgRef from './tryParseForgRef';

describe('tryParseForgRef', () => {
  test.each([
    ['refs/remotes/client1/main', 'client1', 'main'],
    ['refs/remotes/client2/temp', 'client2', 'temp'],
    ['refs/remotes/a12-_aA / \"zn', 'a12-_aA ', ' \"zn'],
  ])('Parses \'%p\' successfully', (ref: string, expectedClientUuid: string, expectedBranchName: string) => {
    const refInfo = tryParseForgRef(ref);
    expect(refInfo).toBeDefined();
    expect(refInfo!.clientUuid).toBe(expectedClientUuid);
    expect(refInfo!.branchName).toBe(expectedBranchName);
  });

  test.each([
    'refs/remotes',
    'refs/remotes/',
    'refs/remotes/missingLevel',
    'refs/remotes/client1/main/unexpectedLeaf',
    'refs/heads/client1/main',
    'refs/heads/client1/main/',
    'Refs/remotes/client1/main',
    'refs/Remotes/client1/main',
    ' refs/remotes/client1/main',
  ])('Rejects invalid \'%p\'', (ref: string) => {
    const refInfo = tryParseForgRef(ref);
    expect(refInfo).toBeUndefined();
  });
});
