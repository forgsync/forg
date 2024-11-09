import { parseConfig } from './parseConfig';

export function decodeConfig(binary: Uint8Array): GitConfig {
  const config = parseConfig(binary);
  return new GitConfig(config);
}

export class GitConfig {
  private readonly _raw: Map<string, string[]>;

  constructor(raw: Map<string, string[]> | undefined) {
    this._raw = raw ?? new Map<string, string[]>();
  }

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
