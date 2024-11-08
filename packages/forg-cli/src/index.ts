#!/usr/bin/env node
//import chalk from 'chalk';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { myFunc } from './myFunc';
import { InitCommand } from './commands/init';
import { CommitCommand } from './commands/commit';
import { CheckoutCommand } from './commands/checkout';
import { FetchCommand } from './commands/fetch';
import { LogCommand } from './commands/log';

//console.log(chalk.green('forg-cli'));

const parser = yargs(hideBin(process.argv))
  .scriptName('forg')
  .showHelpOnFail(false)
  .demandCommand()
  .recommendCommands()
  .help()
  .strict()
  .command<{ aaa: string }>(
    'abc [aaa]',
    'Do abc',
    (yargs) => {
      yargs.positional('aaa', {
        type: 'string',
        default: 'defaultttaa',
        describe: 'some field',
      });
    },
    async (argv) => {
      console.log(`Running command abc with ${argv.aaa}`);
      await myFunc();
    },
  )
  .command(new InitCommand())
  .command(new CommitCommand())
  .command(new CheckoutCommand())
  .command(new FetchCommand())
  .command(new LogCommand())
  ;

(async () => {
  // Already takes care of exit codes on failure...
  await parser.parse();
})();
