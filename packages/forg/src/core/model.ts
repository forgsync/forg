export interface ForgClientInfo {
  uuid: string;
}

export type ForgBranch = ForgRemoteBranch | ForgHeadBranch;
interface ForgBranchBase {
  branchName: string;
}
export interface ForgRemoteBranch extends ForgBranchBase {
  kind: 'remote';
  client: ForgClientInfo;
}
export interface ForgHeadBranch extends ForgBranchBase {
  kind: 'head',
}
