import { CommandModule, Argv, Options, ArgumentsCamelCase } from 'yargs';

import { NodeFS, Path } from '@forgsync/simplefs';
import { loadCommitObject, loadTreeObject, Repo } from '@forgsync/forg/dist/git';
import { GitTreeFS } from '@forgsync/forg/dist/treefs';
import { recursiveCopy } from './util/cp';

interface CheckoutOptions extends Options {
  ref: string;
  workingTreePath: string;
}

export class CheckoutCommand<U extends CheckoutOptions> implements CommandModule<{}, U> {
  readonly command = 'checkout <ref> <workingTreePath>';
  readonly describe = 'Checks-out the working tree of the commit at the provided ref to the specified output path';

  builder(args: Argv): Argv<U> {
    args.positional('ref', { type: 'string', demandOption: true });
    args.positional('workingTreePath', { type: 'string', demandOption: true });
    return args as unknown as Argv<U>;
  }

  async handler(args: ArgumentsCamelCase<U>) {
    const localFs = new NodeFS('.');
    const local = new Repo(localFs);
    await local.init();

    const commitId = await local.getRef(args.ref);
    if (commitId === undefined) {
      throw new Error(`Ref not found: ${args.ref}`);
    }

    const commit = await loadCommitObject(local, commitId);
    const tree = await loadTreeObject(local, commit.body.tree);
    const treeFs = GitTreeFS.fromTree(local, tree);

    const outputFS = new NodeFS(args.workingTreePath);
    await recursiveCopy(treeFs, outputFS, new Path(''));
  }
}
