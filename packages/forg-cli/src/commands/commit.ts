import { Argv, Options, ArgumentsCamelCase } from 'yargs';

import { NodeFS, Path } from '@forgsync/simplefs';
import { GitTreeFS, loadCommitObject, Repo, saveWorkingTree } from '@forgsync/forg/dist/git';
import { commit } from '@forgsync/forg/dist/core/commit';

import { CommandBase } from './util/CommandBase';
import { recursiveCopy } from './util/cp';

interface CommitOptions extends Options {
  workingTreePath: string;
  message: string;
  clientId: string;
  branchName: string;
  allowDuplicate: boolean;
}

export class CommitCommand extends CommandBase<CommitOptions> {
  readonly command = 'commit <workingTreePath>';
  readonly describe = 'Commits the provided working tree and updates the provided ref';

  override builder(args: Argv): Argv<CommitOptions> {
    args.positional('workingTreePath', { type: 'string', demandOption: true });
    args.option('message', { type: 'string', demandOption: true, alias: 'm' });
    args.option('clientId', { type: 'string', demandOption: true, alias: 'c' });
    args.option('branchName', { type: 'string', demandOption: true, alias: 'b' });
    args.option('allowDuplicate', { type: 'boolean', default: false });
    return args as unknown as Argv<CommitOptions>;
  }

  override async handlerCore(args: ArgumentsCamelCase<CommitOptions>) {
    const localFs = new NodeFS('.');
    const local = new Repo(localFs);
    try {
      await local.init();
    } catch (error) {
      throw new Error(`Failed to open repo: ${error}`);
    }

    const inputFS = new NodeFS(args.workingTreePath);
    const newTree = GitTreeFS.fromWorkingTree(local, { type: 'tree', entries: {} });
    await recursiveCopy(inputFS, newTree, new Path(''));

    if (!args.allowDuplicate) {
      const ref = `refs/remotes/${args.clientId}/${args.branchName}`;
      const curCommitId = await local.getRef(ref);
      const curCommit = await loadCommitObject(local, curCommitId);

      const treeHash = await saveWorkingTree(local, newTree.root);
      if (curCommit.body.tree === treeHash) {
        throw new Error(`Working tree is identical to contents of ref ${ref}. Specify '--allowDuplicate' if this was intended`);
      }
    }

    await commit(local, { uuid: args.clientId }, args.branchName, newTree.root, args.message);
  }
}
