import { Person } from "../git";
import { ForgClientInfo } from "./model";

export default function createCommitterInfo(forgClient: ForgClientInfo): Person {
  const now = new Date();
  return {
    name: forgClient.uuid,
    email: `${forgClient.uuid}@forg`, // TODO: Figure out what to use for commiter email
    date: {
      seconds: (new Date().getTime() / 1000) | 0,
      offset: now.getTimezoneOffset(),
    },
  };
}
