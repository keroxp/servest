// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import {
  listenAndServe,
  ServeOptions,
  ServerRequest,
  ServeListener
} from "./server.ts";
import { internalServerError, notFound } from "./responder.ts";
import ListenOptions = Deno.ListenOptions;
import { findLongestAndNearestMatch } from "./router_util.ts";

export interface HttpRouter {
  /** Set global middleware */
  use(handler: HttpHandler);

  handle(pattern: string | RegExp, ...handlers: HttpHandler[]);

  /** Set global error handler. Only one handler can be set at same time */
  handleError(handler: ErrorHandler);

  listen(addr: string | ListenOptions, opts?: ServeOptions): ServeListener;
}

export type RoutedServerRequest = ServerRequest & {
  match?: RegExpMatchArray;
};

/** Basic handler for http request */
export type HttpHandler = (req: RoutedServerRequest) => unknown;

/** Global error handler for requests */
export type ErrorHandler = (e: unknown, req: RoutedServerRequest) => unknown;

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
  function listen(addr: string, opts?: ServeOptions): ServeListener {
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
    return listenAndServe(addr, handler, opts);
  }
  return { handle, use, handleError, listen };
}
