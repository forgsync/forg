import { ForgBranch } from '../model';

/**
 * Tries to parse refs formatted as `refs/remotes/<clientUuid>/<branchName>`
 */
export function tryParseForgRef(ref: string): ForgBranch | undefined {
  const match = ref.match(remoteRefRegex);
  if (match) {
    return {
      client: { uuid: match[1] },
      branchName: match[2],
    };
  }

  return undefined;
}

const remoteRefRegex = /^refs\/remotes\/([^\/]+)\/([^\/]+)$/;
