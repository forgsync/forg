import { IRepo } from "../git";
import { listForgHeads } from "./listForgHeads";
import { ForgClientInfo } from "./model";

export async function reconcile(repo: IRepo, forgClient: ForgClientInfo, branchName: string): Promise<void> {
  const otherHeads = await listForgHeads(repo, forgClient, branchName);
}
