// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import {
  listenAndServe,
  ServeListener,
  ServeOptions,
  ServerRequest
} from "./server.ts";
import { internalServerError } from "./responder.ts";
import { findLongestAndNearestMatch } from "./router_util.ts";
import { methodFilter } from "./middlewares.ts";
import { RoutingError } from "./error.ts";
import { kHttpStatusMessages } from "./serveio.ts";
import { createLogger, Logger, Loglevel, namedLogger } from "./logger.ts";
import ListenOptions = Deno.ListenOptions;

export interface HttpRouter {
  /** Set global middleware */
  use(handler: HttpHandler);

  /** Register route for any http method */
  handle(pattern: string | RegExp, ...handlers: HttpHandler[]);

  /** Register GET route */
  get(pattern: string | RegExp, ...handlers: HttpHandler[]);

  /** Register POST route */
  post(patter: string | RegExp, ...handlers: HttpHandler[]);

  /** Set global error handler. Only one handler can be set at same time */
  handleError(handler: ErrorHandler);

  /** Start listening with given addr */
  listen(addr: string | ListenOptions, opts?: ServeOptions): ServeListener;
}

export type RoutedServerRequest = ServerRequest & {
  match?: RegExpMatchArray;
};

/** Basic handler for http request */
export type HttpHandler = (req: RoutedServerRequest) => Promise<any>;

/** Global error handler for requests */
export type ErrorHandler = (
  e: any,
  req: RoutedServerRequest
) => any | Promise<any>;

export type RouterOptions = {
  logger?: Logger;
  logLevel?: Loglevel;
};

/** create HttpRouter object */
export function createRouter(
  opts: RouterOptions = {
    logger: createLogger()
  }
): HttpRouter {
  const middlewares: HttpHandler[] = [];
  const { info, error } = namedLogger("servest:router", opts.logger);
  const finalErrorHandler = async (e: any, req: RoutedServerRequest) => {
    if (e instanceof RoutingError) {
      logRouteStatus(req, e.status);
      await req.respond({
        status: e.status,
        body: e.message
      });
    } else {
      logRouteStatus(req, 500);
      if (e instanceof Error) {
        await req.respond({
          status: 500,
          body: e.stack
        });
        error(e.stack);
      } else {
        await req.respond(internalServerError());
        error(e);
      }
    }
  };
  const logRouteStatus = (req: ServerRequest, status: number) => {
    info(`${status} ${req.method} ${req.url}`);
  };
  let errorHandler: ErrorHandler = finalErrorHandler;
  const routes: { pattern: string | RegExp; handlers: HttpHandler[] }[] = [];
  function handlerToString(handlers: HttpHandler[]): string {
    return handlers.map(v => v.name).join(" ");
  }
  function handle(pattern: string | RegExp, ...handlers: HttpHandler[]) {
    info(`route: * ${pattern} ${handlerToString(handlers)}`);
    routes.push({ pattern, handlers });
  }

  function get(pattern: string | RegExp, ...handlers: HttpHandler[]) {
    info(`route: GET ${pattern} ${handlerToString(handlers)}`);
    routes.push({
      pattern,
      handlers: [methodFilter("GET", "HEAD"), ...handlers]
    });
  }

  function post(pattern: string | RegExp, ...handlers: HttpHandler[]) {
    info(`route: POST ${pattern} ${handlerToString(handlers)}`);
    routes.push({ pattern, handlers: [methodFilter("POST"), ...handlers] });
  }

  function use(middleware: HttpHandler) {
    info(`use: ${handlerToString([middleware])}`);
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
          logRouteStatus(req, req.respondedStatus());
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
          await handler({ ...req, match });
          if (req.isResponded()) {
            logRouteStatus(req, req.respondedStatus());
            break;
          }
        }
        if (!req.isResponded()) {
          throw new RoutingError(404, kHttpStatusMessages[404]);
        }
      } else {
        throw new RoutingError(404, kHttpStatusMessages[404]);
      }
    };
    const handler = async req => {
      const onError = async (e: any) => {
        try {
          await errorHandler(e, req);
        } catch (e) {
          if (!req.isResponded()) {
            await finalErrorHandler(e, req);
          }
        } finally {
          if (!req.isResponded()) {
            await finalErrorHandler(e, req);
          }
        }
      };
      return handleInternal(req).catch(onError);
    };
    const listener = listenAndServe(addr, handler, opts);
    info(`listening on ${addr}`);
    return listener;
  }
  return { handle, use, get, post, handleError, listen };
}
