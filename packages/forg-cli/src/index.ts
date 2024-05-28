#!/usr/bin/env node
//import chalk from 'chalk';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { myFunc } from './myFunc';

//console.log(chalk.green('forg-cli'));

const parser = yargs(hideBin(process.argv))
  .showHelpOnFail(true)
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
      myFunc();
      console.log(`Ran command abc with ${argv.aaa}`);
    },
  );

(async () => {
  // Already takes care of exit codes on failure...
  await parser.parse();
})();
