import { IReadOnlyRepo } from './Repo';
import { decodeConfig, GitConfig } from './encoding/decodeConfig';
import { GitDbErrno, GitDbError } from './errors';

export async function loadConfig(repo: IReadOnlyRepo): Promise<GitConfig | undefined> {
  const binary = await repo.loadMetadata('config');
  if (binary === undefined) {
    return undefined;
  }

  try {
    return decodeConfig(binary);
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GitDbError(GitDbErrno.InvalidData, `Invalid config: ${message}`);
  }
}
