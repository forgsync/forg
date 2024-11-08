import { CommandModule, ArgumentsCamelCase, Argv } from 'yargs';

export abstract class CommandBase<TOptions> implements CommandModule<{}, TOptions> {
  constructor() {
    this.handler = this.handler.bind(this);
    this.builder = this.builder.bind(this);
  }

  async handler(args: ArgumentsCamelCase<TOptions>) {
    try {
      await this.handlerCore(args);
    } catch (error) {
      console.log(error);
      process.exit(1);
    }
  }

  abstract builder(args: Argv): Argv<TOptions>;
  abstract handlerCore(args: ArgumentsCamelCase<TOptions>);
}
