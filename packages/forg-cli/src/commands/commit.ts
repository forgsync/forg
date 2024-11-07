import { CommandModule, Argv, Options, ArgumentsCamelCase } from 'yargs';

import { NodeFS, Path } from '@forgsync/simplefs';
import { Repo } from '@forgsync/forg/dist/git';
import { GitTreeFS } from '@forgsync/forg/dist/treefs';
import { commit } from '@forgsync/forg/dist/core/commit';
import { recursiveCopy } from './util/cp';

interface CommitOptions extends Options {
  workingTreePath: string;
  message: string;
  clientId: string;
  branchName: string;
}

export class CommitCommand<U extends CommitOptions> implements CommandModule<{}, U> {
  readonly command = 'commit [workingTreePath]';
  readonly describe = 'Commits the provided working tree and updates the provided ref'

  builder(args: Argv): Argv<U> {
    args.positional('workingTreePath', { type: 'string', demandOption: true });
    args.option('message', { type: 'string', demandOption: true, alias: 'm' });
    args.option('clientId', { type: 'string', demandOption: true, alias: 'c' });
    args.option('branchName', { type: 'string', demandOption: true, alias: 'b' });
    return args as unknown as Argv<U>
  }

  async handler(args: ArgumentsCamelCase<U>) {
    const localFs = new NodeFS('.');
    const local = new Repo(localFs);
    await local.init();

    const inputFS = new NodeFS(args.workingTreePath);
    const newTree = GitTreeFS.fromWorkingTree(local, { type: 'tree', entries: {} });
    await recursiveCopy(inputFS, newTree, new Path(''));

    await commit(local, { uuid: args.clientId }, args.branchName, newTree.root, args.message);
  }
}
