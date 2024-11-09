import { IReadOnlyRepo } from './Repo';
import { decodeConfig, GitConfig } from './encoding/decodeConfig';

export async function loadConfig(repo: IReadOnlyRepo): Promise<GitConfig> {
  const binary = await repo.loadMetadata('config');
  const config = binary !== undefined ? decodeConfig(binary) : new GitConfig(undefined);
  return config;
}
