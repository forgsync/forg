import { CommitObject, Hash } from "../git";

export interface ForgClientInfo {
  uuid: string;
}

export interface ForgBranch {
  client: ForgClientInfo;
  branchName: string;
}

export interface HeadInfo {
  commitId: Hash;
  commit: CommitObject;
}
