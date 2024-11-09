import { IReadOnlyRepo } from './Repo';
import { decodeConfig } from './encoding/config';

export async function loadConfig(repo: IReadOnlyRepo): Promise<GitConfig> {
  const binary = await repo.loadMetadata('config');
  const config = binary !== undefined ? decodeConfig(binary) : new Map<string, string[]>();
  return new GitConfig(config);
}

export class GitConfig {
  constructor(
    private readonly _raw: Map<string, string[]>
  ) { }

  getString(name: string): string | undefined {
    const values = this._raw.get(name);
    if (values === undefined) {
      return undefined;
    }

    return values[values.length - 1];
  }

  getNumber(name: string): number | undefined {
    const value = this.getString(name);
    const number = Number(value);
    if (Number.isNaN(number)) {
      // TODO: Handle suffixes like m,k,g
      throw new Error(`Config is not a valid number`);
    }
    return number;
  }
}
