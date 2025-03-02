import { Argv, Options, ArgumentsCamelCase } from 'yargs';

import { NodeFS } from '@forgsync/simplefs';
import { Repo } from '@forgsync/forg/dist/git';
import { forceFetchRefs } from '@forgsync/forg/dist/core';

import { CommandBase } from './util/CommandBase';

interface FetchOptions extends Options {
  remote: string;
  clientId: string;
}

export class FetchCommand extends CommandBase<FetchOptions> {
  readonly command = 'fetch <remote>';
  readonly describe = 'Fetches from a remote forg repo';

  override builder(args: Argv): Argv<FetchOptions> {
    args.positional('remote', { type: 'string', demandOption: true });
    args.option('clientId', { type: 'string', demandOption: true, alias: 'c' });
    return args as unknown as Argv<FetchOptions>;
  }

  override async handlerCore(args: ArgumentsCamelCase<FetchOptions>) {
    const localFs = new NodeFS('.');
    const local = new Repo(localFs);
    try {
      await local.init();
    } catch (error) {
      throw new Error(`Failed to open local repo: ${error}`);
    }

    const remoteFs = new NodeFS(args.remote);
    const remote = new Repo(remoteFs);
    try {
      await remote.init();
    } catch (error) {
      throw new Error(`Failed to open remote repo: ${error}`);
    }

    await forceFetchRefs(local, remote, { uuid: args.clientId });
  }
}
