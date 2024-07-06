import { Person, SecondsWithOffset } from "../model";
import { sanitizeString } from "./util";

export function decodePerson(string: string): Person {
  const match = string.match(/^([^<]*) <([^>]*)> ([^ ]*) (.*)$/);
  if (!match) throw new Error("Improperly formatted person string");
  return {
    name: match[1],
    email: match[2],
    date: {
      seconds: parseInt(match[3], 10),
      offset: parseInt(match[4], 10) / 100 * -60
    }
  };
}

export function encodePerson(person: Person) {
  return sanitizeString(person.name) +
    " <" + sanitizeString(person.email) + "> " +
    formatDate(person.date);
}

function two(num: number) {
  return (num < 10 ? "0" : "") + num;
}

function formatDate(date: Date | SecondsWithOffset) {
  let seconds, offset;
  if (isSecondsWithOffset(date)) {
    seconds = date.seconds;
    offset = date.offset;
  }
  // Also accept Date instances
  else {
    seconds = Math.floor(date.getTime() / 1000);
    offset = date.getTimezoneOffset();
  }
  let neg = "+";
  if (offset <= 0) offset = -offset;
  else neg = "-";
  offset = neg + two(Math.floor(offset / 60)) + two(offset % 60);
  return seconds + " " + offset;
}

function isSecondsWithOffset(value: Date | SecondsWithOffset): value is SecondsWithOffset {
  return "seconds" in value;
}
