import { ForgBranch } from "../model";

/**
 * Forms a string in the format `refs/remotes/<clientUuid>/<branchName>`.
 */
export function formatForgRef(branch: ForgBranch): string {
  return `refs/remotes/${branch.client.uuid}/${branch.branchName}`;
}
