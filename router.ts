import {
  findLongestAndNearestMatch,
  PrefixMatcher,
  prefixMatcher
} from "./matcher.ts";
import { ServerRequest, ServeHandler, ServeHandlerIface } from "./server.ts";
import { kHttpStatusMessages } from "./serveio.ts";
import { RoutingError } from "./error.ts";
import {
  acceptWebSocket,
  acceptable,
  WebSocket
} from "./vendor/https/deno.land/std/ws/mod.ts";
import { namedLogger, NamedLogger } from "./logger.ts";
import { methodFilter } from "./middleware.ts";

export interface RoutedServerRequest extends ServerRequest {
  /** Match object for route with regexp pattern. */
  match: RegExpMatchArray;
} /** Basic handler for http request */

export type RouteHandler = ServeHandler<RoutedServerRequest>;

/** WebSocket Handler */
export type WebSocketHandler = (
  sock: WebSocket,
  req: RoutedServerRequest
) => void | Promise<void>;

/** Global error handler for requests */
export type ErrorHandler = (
  e: any | RoutingError,
  req: ServerRequest
) => void | Promise<void>;

export interface Router extends ServeHandlerIface {
  /**
   * Set global middleware.
   * It will be called for each request on any routes.
   * */
  use(...handlers: ServeHandler[]): void;
  use(prefixPattern: string | RegExp, ...handlers: ServeHandler[]): void;

  /**
   * Register route with given pattern.
   * It will be called for every http method,
   * Examples:
   *   router.handle("/", ...)   => Called if request path exactly matches "/".
   *   router.handle(/^\//, ...) => Called if request path matches given regexp.
   * */
  route(pattern: string | RegExp, ...handlers: RouteHandler[]): void;

  /**
   * Register GET route.
   * Handlers will be called on GET and HEAD method.
   * */
  get(pattern: string | RegExp, ...handlers: RouteHandler[]): void;

  /** Register POST route */
  post(patter: string | RegExp, ...handlers: RouteHandler[]): void;

  /** Accept ws upgrade */
  ws(pattern: string | RegExp, ...handler: WebSocketHandler[]): void;
  ws(
    pattern: string | RegExp,
    handlers: RouteHandler[],
    handler: WebSocketHandler
  ): void;

  /**
   * Set global error handler.
   * All unhandled promise rejections while processing requests will be passed into this handler.
   * If error is ignored, it will be handled by built-in final error handler.
   * Only one handler can be set for one router. */
  catch(handler: ErrorHandler): void;
}

export type Route = {
  pattern: string | RegExp;
  handlers: RouteHandler[];
  wsHandler?: WebSocketHandler;
};

function isServeHandler(x: any): x is ServeHandler {
  return x != null && typeof x === "object" && typeof x.handle === "function";
}

export function createRouter(opts?: {
  logger?: NamedLogger;
  name?: string;
}): Router {
  const { info, error } = opts?.logger ?? namedLogger("servest:router");
  const middlewareList: {
    prefixer?: PrefixMatcher;
    handler: ServeHandler;
  }[] = [];
  const routes: Route[] = [];
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

  function handlerToString(handlers: RouteHandler[]): string {
    return handlers.map(v => {
      if (isServeHandler(v)) return "Router";
      else return v.name;
    }).join(" ");
  }

  function route(pattern: string | RegExp, ...handlers: RouteHandler[]) {
    info(`route: * ${pattern} ${handlerToString(handlers)}`);
    routes.push({ pattern, handlers });
  }

  function get(pattern: string | RegExp, ...handlers: RouteHandler[]) {
    info(`route: GET ${pattern} ${handlerToString(handlers)}`);
    routes.push({
      pattern,
      handlers: [methodFilter("GET", "HEAD"), ...handlers]
    });
  }

  function post(pattern: string | RegExp, ...handlers: RouteHandler[]) {
    info(`route: POST ${pattern} ${handlerToString(handlers)}`);
    routes.push({ pattern, handlers: [methodFilter("POST"), ...handlers] });
  }

  function use(
    prefixOrHandler: string | RegExp | ServeHandler,
    ...rest: ServeHandler[]
  ) {
    let prefixer: PrefixMatcher | undefined;
    let handlers: ServeHandler[];
    if (
      typeof prefixOrHandler === "string" || prefixOrHandler instanceof RegExp
    ) {
      prefixer = prefixMatcher(prefixOrHandler);
      handlers = rest;
    } else {
      handlers = [prefixOrHandler, ...rest];
    }
    const results = handlers.map(handler => ({ handler, prefixer }));
    middlewareList.push(...results);
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

  function _catch(handler: ErrorHandler) {
    errorHandler = handler;
  }

  async function handleInternal(req: ServerRequest) {
    for (const middleware of middlewareList) {
      const { prefixer, handler } = middleware;
      const shouldUse = prefixer?.(req.path) ?? true;
      if (!shouldUse) {
        continue;
      }
      if (typeof handler === "function") {
        await handler(req);
      } else {
        await handler.handle(req);
      }
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
      const routedReq = { ...req, match };
      for (const handler of handlers) {
        if (typeof handler === "function") {
          await handler(routedReq);
        } else {
          await handler.handle(routedReq);
        }
        if (req.isResponded()) {
          logRouteStatus(req, req.respondedStatus()!);
          break;
        }
      }
      if (wsHandler && acceptable(req)) {
        const sock = await acceptWebSocket(req);
        req.markAsResponded(101);
        wsHandler(sock, routedReq);
      }
      if (!req.isResponded()) {
        throw new RoutingError(404, kHttpStatusMessages[404]);
      }
    } else {
      throw new RoutingError(404, kHttpStatusMessages[404]);
    }
  }
  const handle = async (req: ServerRequest) => {
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
    await handleInternal(req).catch(onError);
  };
  return { handle, use, route, get, post, ws, catch: _catch };
}
