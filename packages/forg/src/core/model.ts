export interface ForgClientInfo {
  uuid: string;
}

export interface ForgBranch {
  branchName: string;
  client: ForgClientInfo;
}
