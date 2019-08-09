// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { listenAndServe, ServeOptions, ServerRequest } from "./server.ts";
import { encode } from "https://deno.land/std@v0.12.0/strings/encode.ts";

export type RoutedServerRequest = ServerRequest & {
  match?: RegExpMatchArray;
};

/** basic handler for http request */
export type HttpHandler = (req: RoutedServerRequest) => unknown;

/**
 * Find the match that appeared in the nearest position to the beginning of word.
 * If positions are same, the longest one will be picked.
 * Return -1 and null if no match found.
 * */
export function findLongestAndNearestMatch(
  pathname: string,
  patterns: (string | RegExp)[]
): { index: number; match: RegExpMatchArray } {
  let lastMatchIndex = pathname.length;
  let lastMatchLength = 0;
  let match: RegExpMatchArray = null;
  let index = -1;
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const m = pathname.match(pattern);
    if (!m) continue;
    if (
      m.index < lastMatchIndex ||
      (m.index === lastMatchIndex && m[0].length > lastMatchLength)
    ) {
      index = i;
      match = m;
      lastMatchIndex = m.index;
      lastMatchLength = m[0].length;
    }
  }
  return { index, match };
}

export interface HttpRouter {
  handle(pattern: string | RegExp, handlers: HttpHandler);

  listen(addr: string, opts?: ServeOptions): void;
}

/** create HttpRouter object */
export function createRouter(): HttpRouter {
  const routes: { pattern: string | RegExp; handlers: HttpHandler[] }[] = [];
  return {
    handle(pattern: string | RegExp, ...handlers: HttpHandler[]) {
      routes.push({ pattern, handlers });
    },
    listen(addr: string, opts?: ServeOptions) {
      listenAndServe(
        addr,
        async req => {
          let { pathname } = new URL(req.url, addr);
          const { index, match } = findLongestAndNearestMatch(
            pathname,
            routes.map(v => v.pattern)
          );
          if (index > -1) {
            const { handlers } = routes[index];
            for (const handler of handlers) {
              await handler(Object.assign(req, { match }));
              if (req.isResponded()) {
                break;
              }
            }
            if (!req.isResponded()) {
              await req.respond({
                status: 500,
                headers: new Headers(),
                body: encode("Not Responded")
              });
            }
          } else {
            await req.respond({
              status: 404,
              headers: new Headers(),
              body: encode("Not Found")
            });
          }
        },
        opts
      );
    }
  };
}
