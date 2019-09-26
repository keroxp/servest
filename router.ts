// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { listenAndServe, ServeOptions, ServerRequest } from "./server.ts";
import { internalServerError, notFound } from "./responder.ts";
import ListenOptions = Deno.ListenOptions;

export type RoutedServerRequest = ServerRequest & {
  match?: RegExpMatchArray;
};

/** Basic handler for http request */
export type HttpHandler = (req: RoutedServerRequest) => unknown;

/** Global error handler for requests */
export type ErrorHandler = (e: unknown, req: RoutedServerRequest) => unknown;

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
  let match: RegExpMatchArray | null = null;
  let index = -1;
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    if (pattern instanceof RegExp) {
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
    } else if (
      pathname.startsWith(pattern) &&
      pattern.length > lastMatchLength
    ) {
      index = i;
      match = [pattern];
      lastMatchIndex = 0;
      lastMatchLength = pattern.length;
    }
  }
  return { index, match };
}

export interface HttpRouter {
  /** Set global middleware */
  use(handler: HttpHandler);

  handle(pattern: string | RegExp, handlers: HttpHandler);

  /** Set global error handler. Only one handler can be set at same time */
  handleError(handler: ErrorHandler);

  listen(addr: string | ListenOptions, opts?: ServeOptions): void;
}

/** create HttpRouter object */
export function createRouter(): HttpRouter {
  const middlewares: HttpHandler[] = [];
  const finalErrorHandler = async (e: unknown, req: RoutedServerRequest) => {
    if (e) {
      console.error(e);
    }
    await req.respond(internalServerError());
  };
  let errorHandler: ErrorHandler = finalErrorHandler;
  const routes: { pattern: string | RegExp; handlers: HttpHandler[] }[] = [];
  function handle(pattern: string | RegExp, ...handlers: HttpHandler[]) {
    routes.push({ pattern, handlers });
  }
  function use(middleware: HttpHandler) {
    middlewares.push(middleware);
  }
  function handleError(handler: ErrorHandler) {
    errorHandler = handler;
  }
  function listen(addr: string, opts?: ServeOptions) {
    const handleInternal = async req => {
      let { pathname } = new URL(req.url, "http://localhost");
      for (const middleware of middlewares) {
        await middleware(req);
        if (req.isResponded()) {
          return;
        }
      }
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
          return await req.respond(notFound());
        }
      } else {
        return await req.respond(notFound());
      }
    };
    const handler = async req => {
      const onError = async (e: unknown) => {
        try {
          await errorHandler(e, req);
        } catch (e) {
          if (!req.isResponded()) {
            await finalErrorHandler(e, req);
          }
        } finally {
          if (!req.isResponded()) {
            await finalErrorHandler(undefined, req);
          }
        }
      };
      return handleInternal(req).catch(onError);
    };
    listenAndServe(addr, handler, opts);
  }
  return { handle, use, handleError, listen };
}
