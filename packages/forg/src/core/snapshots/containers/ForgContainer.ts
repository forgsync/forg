import { Errno, FSError, Path } from "@forgsync/simplefs";
import { GitTreeFS, Hash } from "../../../git";
import { HeadInfo } from "../../model";
import { ForgContainerConfigJsonDto } from "./ForgContainerConfigJsonDto";
import { decode } from "../../../git/db/encoding/util";
import { errorToString } from "../../../git/db/util";

export class ForgContainer {
  private constructor(
    readonly head: HeadInfo,
    readonly rootFS: GitTreeFS,
    readonly config: ForgContainerConfigJsonDto,
  ) { }

  get treeHash(): Hash {
    return this.rootFS.hash;
  }

  static async create(head: HeadInfo, containerRoot: GitTreeFS): Promise<ForgContainer> {
    const config = await this._readConfig(containerRoot);
    return new ForgContainer(head, containerRoot, config);
  }

  private static async _readConfig(containerRoot: GitTreeFS) {
    const configPath = new Path('.forgcontainer.json');
    let binary: Uint8Array;
    try {
      binary = await containerRoot.read(configPath);
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
