import { ForgBranch, ForgHeadBranch, ForgRemoteBranch } from "../model";

/**
 * Tries to parse refs formatted as `refs/remotes/<clientUuid>/<branchName>` or `refs/heads/<branchName>`
 */
export function tryParseForgRef(ref: string): ForgBranch | undefined {
  return tryParseForgRemoteRef(ref) || tryParseForgHeadRef(ref);
}

/**
 * Tries to parse refs formatted as `refs/remotes/<clientUuid>/<branchName>`
 */
export function tryParseForgRemoteRef(ref: string): ForgRemoteBranch | undefined {
  const match = ref.match(remoteRefRegex);
  if (match) {
    return {
      kind: 'remote',
      client: { uuid: match[1] },
      branchName: match[2],
    };
  }

  return undefined;
}

/**
 * Tries to parse refs formatted as `refs/heads/<branchName>`
 */
export function tryParseForgHeadRef(ref: string): ForgHeadBranch | undefined {
  const headMatch = ref.match(headRefRegex);
  if (headMatch) {
    return {
      kind: 'head',
      branchName: headMatch[1],
    }
  }

  return undefined;
}

const remoteRefRegex = /^refs\/remotes\/([^\/]+)\/([^\/]+)$/;
const headRefRegex = /^refs\/heads\/([^\/]+)$/;
