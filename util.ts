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
export function dateToDateHeader(time: Date = new Date()): string {
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
