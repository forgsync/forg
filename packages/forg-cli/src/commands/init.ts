import { Argv, Options, ArgumentsCamelCase } from 'yargs';

import { NodeFS } from '@forgsync/simplefs';
import { Repo } from '@forgsync/forg/dist/git';
import { InitMode } from '@forgsync/forg/dist/git/db/Repo';

import { CommandBase } from './util/CommandBase';

interface InitOptions extends Options {
  path: string;
}

export class InitCommand extends CommandBase<InitOptions> {
  readonly command = 'init [path]';
  readonly describe = 'Initializes a forg repo';

  override builder(args: Argv): Argv<InitOptions> {
    args.positional('path', { type: 'string', default: './' });
    return args as unknown as Argv<InitOptions>;
  }

  override async handlerCore(args: ArgumentsCamelCase<InitOptions>) {
    const fs = new NodeFS(args.path);
    const repo = new Repo(fs);
    const result = await repo.init(InitMode.CreateIfNotExists);

    if (result === 'init') {
      console.log(`Initialized empty Forg repository in ${fs.physicalRoot}`);
    } else {
      console.log(`Reinitialized existing Forg repository in ${fs.physicalRoot}`);
    }
  }
}
