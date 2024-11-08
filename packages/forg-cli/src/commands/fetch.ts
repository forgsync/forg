import { CommandModule, Argv, Options, ArgumentsCamelCase } from 'yargs';

import { NodeFS } from '@forgsync/simplefs';
import { Repo } from '@forgsync/forg/dist/git';
import { fetchRefs } from '@forgsync/forg/dist/core';
import { SyncStrategy } from '@forgsync/forg/dist/git/sync/syncRef';

interface FetchOptions extends Options {
  remote: string;
  clientId: string;
}

export class FetchCommand<U extends FetchOptions> implements CommandModule<{}, U> {
  readonly command = 'fetch <remote>';
  readonly describe = 'Fetches from a remote forg repo';

  builder(args: Argv): Argv<U> {
    args.positional('remote', { type: 'string', demandOption: true });
    args.option('clientId', { type: 'string', demandOption: true, alias: 'c' });
    return args as unknown as Argv<U>;
  }

  async handler(args: ArgumentsCamelCase<U>) {
    const localFs = new NodeFS('.');
    const local = new Repo(localFs);
    await local.init();

    const remoteFs = new NodeFS(args.remote);
    const remote = new Repo(remoteFs);
    await remote.init();

    await fetchRefs(remote, local, { uuid: args.clientId }, SyncStrategy.DefaultForFetch);
  }
}
