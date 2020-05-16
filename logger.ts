// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import {
  red,
  yellow,
  cyan,
  gray,
} from "./vendor/https/deno.land/std/fmt/colors.ts";
import { sprintf } from "./vendor/https/deno.land/std/fmt/sprintf.ts";
export enum Loglevel {
  DEBUG,
  INFO,
  WARN,
  ERROR,
  NONE,
}

export interface Logger {
  (level: Loglevel, msg: string, ...args: any[]): void;
}
let logLevel = Loglevel.INFO;
export function setLevel(level: Loglevel) {
  logLevel = level;
}
const kPrefixMap = new Map<Loglevel, string>([
  [Loglevel.INFO, "I"],
  [Loglevel.DEBUG, "D"],
  [Loglevel.WARN, "W"],
  [Loglevel.ERROR, "E"],
]);
interface ColorFunc {
  (msg: string): string;
}
const plain: ColorFunc = (msg) => msg;
const kColorFuncMap = new Map<Loglevel, ColorFunc>([
  [Loglevel.DEBUG, gray],
  [Loglevel.INFO, cyan],
  [Loglevel.WARN, yellow],
  [Loglevel.ERROR, red],
]);
export interface NamedLogger {
  debug(msg: string, ...args: any[]): void;
  info(msg: string, ...args: any[]): void;
  warn(msg: string, ...args: any[]): void;
  error(msg: string, ...args: any[]): void;
}

export function createLogger(
  handler: Logger = (level, msg, ...args) => console.log(msg, ...args),
  {
    prefixMap = kPrefixMap,
    prefixColorMap = kColorFuncMap,
    prefixFmt = "%s[%s] %s",
    noColor = false,
  }: {
    prefixFmt?: string;
    prefixMap?: Map<Loglevel, string>;
    prefixColorMap?: Map<Loglevel, ColorFunc>;
    noColor?: boolean;
  } = {},
): Logger {
  return function log(level: Loglevel, msg: string, ...args: any[]) {
    if (level < logLevel) return;
    const prefix = prefixMap.get(level) || "D";
    let color = prefixColorMap.get(level);
    if (noColor || !color) {
      color = plain;
    }
    // [INFO] namespace msg
    const now = new Date();
    if (logLevel <= level) {
      handler(
        level,
        sprintf(prefixFmt, color(prefix), now.toISOString(), msg),
        ...args,
      );
    }
  };
}

export function namedLogger(
  namespace: string,
  handler: Logger = createLogger(),
): NamedLogger {
  const wrap = (msg: string) => `${namespace} ${msg}`;
  return {
    debug(msg: string, ...args: any[]) {
      handler(Loglevel.DEBUG, wrap(msg), ...args);
    },
    error(msg: string, ...args: any[]) {
      handler(Loglevel.ERROR, wrap(msg), ...args);
    },
    info(msg: string, ...args: any[]) {
      handler(Loglevel.INFO, wrap(msg), ...args);
    },
    warn(msg: string, ...args: any[]) {
      handler(Loglevel.ERROR, wrap(msg), ...args);
    },
  };
}
