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
}
 /** Router handler */
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

  /**
   * Register route with given pattern.
   * It will be called for every http method,
   * Examples:
   *   router.handle("/", ...)   => Called if request path exactly matches "/".
   *   router.handle(/^\//, ...) => Called if request path matches given regexp.
   * */
  handle(pattern: string | RegExp, ...handlers: RouteHandler[]): void;

  /**
   * Register route with given prefixer.
   * This is similar to router.handle() but different in several points:
   *  - Only string prefix can be passed.
   *  - Handlers will be called if req.path STARTS WITH prefix
   *  - route() doesn't designate a single route handler set before dispatching.
   *    This means it will keep calling all handler sets that matches prefixer until someone responds.
   *  - route can accept Router
   * Examples
   *   router.route("/users", ...)   => Called if request path STARTS WITH "/users".
   */
  route(prefix: string, ...handlers: (RouteHandler|Router)[]): void;

  /**
   * Register GET route. This is shortcut for handle();
   * Handlers will be called on GET and HEAD method.
   * */
  get(pattern: string | RegExp, ...handlers: RouteHandler[]): void;

  /** Register POST route. This is shortcut for handle() */
  post(pattern: string | RegExp, ...handlers: RouteHandler[]): void;

  /** Accept ws upgrade */
  ws(pattern: string | RegExp, handler: WebSocketHandler): void;
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

  // internal
  handleRoute(prefix: string, req: ServerRequest): Promise<void>
}

function isServeHandlerIface(x: any): x is ServeHandlerIface {
  return x != null && typeof x === "object" && typeof x.handle === "function";
}

function isRouter(x: any): x is Router {
  return typeof x.handleRoute === "function" && isServeHandlerIface(x);
}

export function createRouter(opts?: {
  logger?: NamedLogger;
  name?: string;
}): Router {
  const { info, error } = opts?.logger ?? namedLogger("servest:router");
  const middlewareList: ServeHandler[] = [];
  const routes: {
    pattern: string | RegExp;
    handlers: RouteHandler[];
    wsHandler?: WebSocketHandler;
  }[] = [];
  const prefixers: {
    prefix: string;
    handlers: RouteHandler[];
  }[] = [];
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

  function handle(pattern: string | RegExp, ...handlers: RouteHandler[]) {
    routes.push({ pattern, handlers });
  }

  function route(prefix: string, ...handlers: RouteHandler[]) {
    prefixers.push({ prefix, handlers });
  }

  function get(pattern: string | RegExp, ...handlers: RouteHandler[]) {
    routes.push({
      pattern,
      handlers: [methodFilter("GET", "HEAD"), ...handlers]
    });
  }

  function post(pattern: string | RegExp, ...handlers: RouteHandler[]) {
    routes.push({ pattern, handlers: [methodFilter("POST"), ...handlers] });
  }

  function use(...handlers: ServeHandler[]) {
    middlewareList.push(...handlers);
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

  async function chainRoutes(    
    prefix: string,
    req: RoutedServerRequest,
    handlers: (RouteHandler|Router)[]
  ): Promise<boolean> {
    for (const handler of handlers) {
      if (isRouter(handler)){
        await handler.handleRoute(prefix, req);
      } else if (isServeHandlerIface(handler)) {
        await handler.handleRequest(req);
      } else {
        await handler(req)
      }
      if (req.isResponded()) {
        logRouteStatus(req, req.respondedStatus()!);
        return true;
      }
    }
    return false;
  }
  async function handleRoute(parentMatch: string, req: ServerRequest): Promise<void> {
    for (const handler of middlewareList) {
      if (isServeHandlerIface(handler)) {
        await handler.handleRequest(req);
      } else {
        await handler(req)
      }
      if (req.isResponded()) {
        logRouteStatus(req, req.respondedStatus()!);
        return;
      }    
    }

    const subpath = req.path.slice(parentMatch.length) || "/";
    for (const { prefix, handlers } of prefixers) {
      if (subpath.startsWith(prefix)) {
        const routedReq: RoutedServerRequest = { ...req, match: [prefix] };
        if (await chainRoutes(parentMatch+prefix, routedReq, handlers)) {
          return;
        }
      }
    }
    const { index, match } = findLongestAndNearestMatch(
      subpath,
      routes.map(v => v.pattern)
    );
    if (index > -1 && match) {
      const { handlers, wsHandler } = routes[index];
      const routedReq = { ...req, match };
      if (await chainRoutes(parentMatch + match, routedReq, handlers)) {
        return;
      }
      if (wsHandler && acceptable(routedReq)) {
        const sock = await acceptWebSocket(routedReq);
        routedReq.markAsResponded(101);
        wsHandler(sock, routedReq);
      }
      if (!req.isResponded()) {
        throw new RoutingError(404, kHttpStatusMessages[404]);
      }
    } else {
      throw new RoutingError(404, kHttpStatusMessages[404]);
    }
  }
  const handleRequest = async (req: ServerRequest) => {
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
    await handleRoute("", req).catch(onError);
  };
  return { handleRequest, handleRoute, use, handle, route, get, post, ws, catch: _catch };
}
