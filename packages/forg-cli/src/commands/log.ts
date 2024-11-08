import { Argv, Options, ArgumentsCamelCase } from 'yargs';

import { NodeFS } from '@forgsync/simplefs';
import { loadCommitObject, Repo } from '@forgsync/forg/dist/git';

import { CommandBase } from './util/CommandBase';

interface LogOptions extends Options {
  ref: string;
}

export class LogCommand extends CommandBase<LogOptions> {
  readonly command = 'log <ref>';
  readonly describe = 'Prints the commit history of the specified ref';

  override builder(args: Argv): Argv<LogOptions> {
    args.positional('ref', { type: 'string', demandOption: true });
    return args as unknown as Argv<LogOptions>;
  }

  override async handlerCore(args: ArgumentsCamelCase<LogOptions>) {
    const localFs = new NodeFS('.');
    const local = new Repo(localFs);
    try {
      await local.init();
    } catch (error) {
      throw new Error(`Failed to open repo: ${error}`);
    }

    let commitId = await local.getRef(args.ref);
    if (commitId === undefined) {
      throw new Error(`Ref not found: ${args.ref}`);
    }

    do {
      const commit = await loadCommitObject(local, commitId);
      console.log(`commit ${commitId}`);
      console.log(`Author: ${commit.body.author.name} <${commit.body.author.email}>`);
      console.log(`Date:   ${new Date(commit.body.author.date.seconds * 1000).toISOString()}`);
      console.log();
      console.log(`    ${commit.body.message}`);
      console.log();

      // TODO: Handle merge commits, for now we only follow the first parent
      commitId = commit.body.parents.length > 0 ? commit.body.parents[0] : undefined;
    } while (commitId !== undefined);
  }
}
