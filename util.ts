// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { sprintf } from "./vendor/https/deno.land/std/fmt/sprintf.ts";
const kDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const kMonths = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];
export function dateToIMF(time: Date = new Date()): string {
  //Date: <day-name>, <day> <month> <year> <hour>:<minute>:<second> GMT
  //Date: Wed, 21 Oct 2015 07:28:00 GMT
  const day = kDays[time.getUTCDay()];
  const date = time.getUTCDate();
  const month = kMonths[time.getUTCMonth()];
  const year = time.getUTCFullYear();
  const hour = time.getUTCHours();
  const min = time.getUTCMinutes();
  const sec = time.getUTCSeconds();
  return sprintf(
    "%s, %02d %s %d %02d:%02d:%02d GMT",
    day,
    date,
    month,
    year,
    hour,
    min,
    sec
  );
}

export function parseIMF(str: string): Date {
  const comps = str.split(" ").map(v => v.trim());
  if (comps.length !== 6) {
    throw new Error("invalid imf time style");
  }
  const [_, date, month, year, time] = comps;
  const [hour, min, sec] = time.split(":").map(parseInt);
  const monthNum = kMonths.indexOf(month) + 1;
  return new Date(parseInt(year), monthNum, parseInt(date), hour, min, sec);
}

export function pathResolver(meta: ImportMeta): (p: string) => string {
  return p => new URL(p, meta.url).pathname;
}

export async function readString(r: Deno.Reader): Promise<string> {
  const buf = new Deno.Buffer();
  await Deno.copy(buf, r);
  return buf.toString();
}
