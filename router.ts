// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import {
  listenAndServe,
  listenAndServeTLS,
  ServeHandler,
  ServeListener,
  ServeOptions,
  ServerRequest
} from "./server.ts";
import { findLongestAndNearestMatch } from "./router_util.ts";
import { methodFilter } from "./middleware.ts";
import { RoutingError } from "./error.ts";
import { kHttpStatusMessages } from "./serveio.ts";
import { createLogger, Logger, Loglevel, namedLogger } from "./logger.ts";
import ListenOptions = Deno.ListenOptions;
import ListenTLSOptions = Deno.ListenTLSOptions;
import {
  acceptable,
  acceptWebSocket,
  WebSocket
} from "./vendor/https/deno.land/std/ws/mod.ts";

export interface HttpRouter {
  /**
   * Set global middleware.
   * It will be called for each request on any routes.
   * */
  use(...handlers: HttpHandler[]): void;

  /**
   * Register route with given pattern.
   * It will be called for every http method,
   * Examples:
   *   router.handle("/", ...)   => Called if request path exactly matches "/".
   *   router.handle(/^\//, ...) => Called if request path matches given regexp.
   * */
  handle(pattern: string | RegExp, ...handlers: HttpHandler[]): void;

  /**
   * Register GET route.
   * Handlers will be called on GET and HEAD method.
   * */
  get(pattern: string | RegExp, ...handlers: HttpHandler[]): void;

  /** Register POST route */
  post(patter: string | RegExp, ...handlers: HttpHandler[]): void;

  /** Accept ws upgrade */
  ws(pattern: string | RegExp, ...handler: WebSocketHandler[]): void;
  ws(
    pattern: string | RegExp,
    handlers: HttpHandler[],
    handler: WebSocketHandler
  ): void;

  /**
   * Set global error handler.
   * All unhandled promise rejections while processing requests will be passed into this handler.
   * If error is ignored, it will be handled by built-in final error handler.
   * Only one handler can be set for one router. */
  handleError(handler: ErrorHandler): void;

  /** Start listening with given addr */
  listen(addr: string | ListenOptions, opts?: ServeOptions): ServeListener;

  /** Start listening for HTTPS server */
  listenTLS(tlsOptions: ListenTLSOptions, opts?: ServeOptions): ServeListener;
}

export type RoutedServerRequest = ServerRequest & {
  /** Match object for route with regexp pattern. */
  match: RegExpMatchArray;
};

/** Basic handler for http request */
export type HttpHandler = (req: RoutedServerRequest) => void | Promise<void>;

export type WebSocketHandler = (
  sock: WebSocket,
  req: RoutedServerRequest,
) => void;

/** Global error handler for requests */
export type ErrorHandler = (
  e: any | RoutingError,
  req: ServerRequest
) => void | Promise<void>;

export type RouterOptions = {
  logger?: Logger;
  logLevel?: Loglevel;
};

/** Create HttpRouter */
export function createRouter(
  opts: RouterOptions = {
    logger: createLogger()
  }
): HttpRouter {
  const middlewareList: HttpHandler[] = [];
  const routes: {
    pattern: string | RegExp;
    handlers: HttpHandler[];
    wsHandler?: WebSocketHandler;
  }[] = [];
  const { info, error } = namedLogger("servest:router", opts.logger);
  const finalErrorHandler = async (e: any, req: ServerRequest) => {
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
        if (e.stack) error(e.stack);
      } else {
        await req.respond({
          status: 500,
          body: kHttpStatusMessages[500]
        });
        error(e);
      }
    }
  };
  let errorHandler: ErrorHandler = finalErrorHandler;
  const logRouteStatus = (req: ServerRequest, status: number) => {
    info(`${status} ${req.method} ${req.url}`);
  };
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

  function use(...middleware: HttpHandler[]) {
    info(`use: ${handlerToString(middleware)}`);
    middlewareList.push(...middleware);
  }

  function ws(pattern: string | RegExp, ...args: any[]) {
    if (Array.isArray(args[0])) {
      routes.push({ pattern, handlers: args[0], wsHandler: args[1] });
    } else if (typeof args[0] === "function") {
      routes.push({ pattern, handlers: [], wsHandler: args[0] });
    } else {
      throw new Error("invalid function arguments");
    }
  }

  function handleError(handler: ErrorHandler) {
    errorHandler = handler;
  }

  function createHandler(): ServeHandler {
    const handleInternal = async (req: ServerRequest) => {
      for (const middleware of middlewareList) {
        await middleware({ ...req, match: [] });
        if (req.isResponded()) {
          logRouteStatus(req, req.respondedStatus()!);
          return;
        }
      }
      const { index, match } = findLongestAndNearestMatch(
        req.path,
        routes.map(v => v.pattern)
      );
      if (index > -1 && match) {
        const { handlers, wsHandler } = routes[index];
        const routedReq = {...req, match};
        for (const handler of handlers) {
          await handler(routedReq);
          if (req.isResponded()) {
            logRouteStatus(req, req.respondedStatus()!);
            break;
          }
        }
        if (wsHandler && acceptable(req)) {
          const sock = await acceptWebSocket(req);
          await req.markResponded(101);
          wsHandler(sock, routedReq);
        }
        if (!req.isResponded()) {
          throw new RoutingError(404, kHttpStatusMessages[404]);
        }
      } else {
        throw new RoutingError(404, kHttpStatusMessages[404]);
      }
    };
    return (req: ServerRequest) => {
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
  }
  function listen(
    addr: string | ListenOptions,
    opts?: ServeOptions
  ): ServeListener {
    const handler = createHandler();
    const listener = listenAndServe(
      addr,
      req => {
        return handler(req);
      },
      opts
    );
    info(`listening on ${addr}`);
    return listener;
  }
  function listenTLS(
    listenOptions: ListenTLSOptions,
    opts?: ServeOptions
  ): ServeListener {
    const handler = createHandler();
    const listener = listenAndServeTLS(listenOptions, handler, opts);
    info(`listening on ${listenOptions.hostname || ""}:${listenOptions.port}`);
    return listener;
  }
  return { handle, use, get, post, ws, handleError, listen, listenTLS };
}
