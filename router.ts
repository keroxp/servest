// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { createResponder, ServerResponder } from "./responder.ts";
import { serve, ServerRequest } from "./server.ts";
import { defer } from "./deferred.ts";
import { encode } from "https://deno.land/std@v0.3.1/strings/strings.ts";

export type RoutedServerRequest = ServerRequest & {
  match?: RegExpMatchArray;
};

/** basic handler for http request */
export type HttpHandler = (
  req: RoutedServerRequest,
  res: ServerResponder
) => unknown;

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
  handle(pattern: string | RegExp, handler: HttpHandler);
  listen(addr: string, cancel?: Promise<any>): void;
}

/** create HttpRouter object */
export function createRouter(): HttpRouter {
  return new HttpRouterImpl();
}

class HttpRouterImpl implements HttpRouter {
  private handlers: { pattern: string | RegExp; handler: HttpHandler }[] = [];

  handle(pattern: string | RegExp, handler: HttpHandler) {
    this.handlers.push({ pattern, handler });
  }

  listen(addr: string, cancel = defer<any>().promise) {
    (async () => {
      for await (const req of serve(addr, cancel)) {
        let { pathname } = new URL(req.url, addr);
        const { index, match } = findLongestAndNearestMatch(
          pathname,
          this.handlers.map(v => v.pattern)
        );
        const res = createResponder(req.bufWriter);
        if (index > -1) {
          const { handler } = this.handlers[index];
          await handler(Object.assign(req, { match }), res);
          if (!res.isResponded) {
            await res.respond({
              status: 500,
              headers: new Headers(),
              body: encode("Not Responded")
            });
          }
        } else {
          await res.respond({
            status: 404,
            headers: new Headers(),
            body: encode("Not Found")
          });
        }
      }
    })();
  }
}
