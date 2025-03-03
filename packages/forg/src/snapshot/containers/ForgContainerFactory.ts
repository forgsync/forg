import { Errno, FSError, ISimpleFS, Path } from "@forgsync/simplefs";
import { ForgContainerBase } from "./ForgContainerBase";
import { ForgFileSystemContainer } from "./filesystem/ForgFileSystemContainer";
import { ForgContainerConfigJsonDto } from './ForgContainerConfigJsonDto';
import { errorToString } from "../../git/db/util";
import { decode } from "../../git/db/encoding/util";

export interface ForgContainerResolver {
  predicate: (config: ForgContainerConfigJsonDto) => boolean;
  factory: (root: ISimpleFS, config: ForgContainerConfigJsonDto) => ForgContainerBase;
}

export class ForgContainerFactory {
  private readonly resolvers: ForgContainerResolver[] = [];

  addResolver(resolver: ForgContainerResolver) {
    this.resolvers.push(resolver);
  }

  async resolve(root: ISimpleFS): Promise<ForgContainerBase> {
    const config = await this._readConfig(root);

    for (const resolver of this.resolvers) {
      if (resolver.predicate(config)) {
        return await resolver.factory(root, config);
      }
    }

    throw new Error(`No resolver for container with config ${JSON.stringify(config)}`);
  }

  private async _readConfig(root: ISimpleFS) {
    const configPath = new Path('.forgcontainer.json');
    let binary: Uint8Array;
    try {
      binary = await root.read(configPath);
    }
    catch (error) {
      if (error instanceof FSError && error.errno === Errno.ENOENT) {
        throw new Error(`Missing container config file ${configPath.value}`);
      }

      throw new Error(`Unable to read container config file ${configPath.value}: ${errorToString(error)}`);
    }

    let config: ForgContainerConfigJsonDto;
    try {
      const json = decode(binary);
      config = JSON.parse(json) as ForgContainerConfigJsonDto;
    }
    catch (error) {
      throw new Error(`Invalid container config json in file ${configPath.value}: ${errorToString(error)}`);
    }

    if (!config.type || !config.typeVersion) {
      throw new Error(`Container config json in file ${configPath.value} is missing required fields`);
    }

    return config;
  }
}

export function defaultForgContainerFactory(): ForgContainerFactory {
  const factory = new ForgContainerFactory();
  factory.addResolver({
    predicate: config => config.type === ForgFileSystemContainer.TYPE && config.typeVersion === ForgFileSystemContainer.TYPE_VERSION,
    factory: (root, config) => new ForgFileSystemContainer(root, config),
  });

  return factory;
}
