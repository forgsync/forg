export interface ForgHeadInfo {
  clientUuid: string;
  branchName: string;
}

/**
 * Tries to parse refs formatted as `refs/remotes/<clientUuid>/<branchName>`.
 */
export default function tryParseForgRef(ref: string): ForgHeadInfo | undefined {
  const match = ref.match(forgRefRegex);
  if (match) {
    return {
      clientUuid: match[1],
      branchName: match[2],
    };
  }

  return undefined;
}

const forgRefRegex = /^refs\/remotes\/([^\/]+)\/([^\/]+)$/;
