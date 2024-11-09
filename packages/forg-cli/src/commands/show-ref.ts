import { Argv, Options, ArgumentsCamelCase } from 'yargs';

import { NodeFS } from '@forgsync/simplefs';
import { Repo } from '@forgsync/forg/dist/git';

import { CommandBase } from './util/CommandBase';

interface ShowRefOptions extends Options {
}

export class ShowRefCommand extends CommandBase<ShowRefOptions> {
  readonly command = 'show-ref';
  readonly describe = 'Lists all refs';

  override builder(args: Argv): Argv<ShowRefOptions> {
    return args as unknown as Argv<ShowRefOptions>;
  }

  override async handlerCore(args: ArgumentsCamelCase<ShowRefOptions>) {
    const localFs = new NodeFS('.');
    const local = new Repo(localFs);
    try {
      await local.init();
    } catch (error) {
      throw new Error(`Failed to open repo: ${error}`);
    }

    await printRefs(local, await local.listRefs('refs/heads'));
    await printRefs(local, await local.listRefs('refs/remotes'));
  }
}

async function printRefs(repo: Repo, refs: string[]) {
  for (const ref of refs) {
    const commitId = await repo.getRef(ref);
    if (commitId === undefined) {
      console.log(`<error> ${ref}`);
    } else {
      console.log(`${commitId} ${ref}`);
    }
  }
}
