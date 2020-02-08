// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { sprintf } from "./vendor/https/deno.land/std/fmt/sprintf.ts";
import { deferred, Deferred } from "./vendor/https/deno.land/std/util/async.ts";

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

export function pathResolver(meta: ImportMeta): (p: string) => string {
  return p => new URL(p, meta.url).pathname;
}

export async function readString(r: Deno.Reader): Promise<string> {
  const buf = new Deno.Buffer();
  await Deno.copy(buf, r);
  return buf.toString();
}

export interface PromiseWaitQueue<T, P> {
  enqueue(t: T): Promise<P>;
}

export function promiseWaitQueue<T, P>(
  creator: (t: T) => Promise<P>
): PromiseWaitQueue<T, P> {
  const queue: {
    d: Deferred<P>;
    t: T;
  }[] = [];
  function enqueue(t: T): Promise<P> {
    const d = deferred<P>();
    queue.push({ d, t });
    if (queue.length === 1) {
      dequeue();
    }
    return d;
  }
  function dequeue() {
    const [e] = queue;
    if (!e) return;
    creator(e.t)
      .then(e.d.resolve)
      .catch(e.d.reject)
      .finally(() => {
        queue.shift();
        dequeue();
      });
  }
  return { enqueue };
}
