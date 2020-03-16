import {
  findLongestAndNearestMatch
} from "./matcher.ts";
import { ServerRequest, ServeHandler } from "./server.ts";
import { RoutingError } from "./error.ts";
import {
  acceptWebSocket,
  acceptable,
  WebSocket
} from "./vendor/https/deno.land/std/ws/mod.ts";
import { methodFilter } from "./middleware.ts";
import { assert } from "./vendor/https/deno.land/std/testing/asserts.ts";

/** Router handler */
export type RouteHandler = (req: ServerRequest, params: RouteParams) => void
  | Promise<void>;
export type RouteParams = {
  match: RegExpMatchArray;
};
/** WebSocket Handler */
export type WebSocketHandler = (
  sock: WebSocket,
  req: ServerRequest,
  params: RouteParams
) => void | Promise<void>;

/** Global error handler for requests */
export type ErrorHandler = (
  e: any | RoutingError,
  req: ServerRequest
) => void | Promise<void>;

export interface Router {
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
  route(prefix: string, ...handlers: (RouteHandler | Router)[]): void;

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

  finally(handler: ServeHandler): void;

  // internal
  handleRoute(prefix: string, req: ServerRequest): Promise<void>;
}

function isRouter(x: any): x is Router {
  return typeof x?.handleRoute === "function";
}

export function createRouter(): Router {
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

  let errorHandler: ErrorHandler | undefined;
  let finalHandler: ServeHandler | undefined;

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

  function _finally(handler: ServeHandler) {
    finalHandler = handler;
  }

  async function chainRoutes(
    prefix: string,
    req: ServerRequest,
    params: RouteParams,
    handlers: (RouteHandler | Router)[]
  ): Promise<boolean> {
    for (const handler of handlers) {
      if (isRouter(handler)) {
        await handler.handleRoute(prefix, req);
      } else {
        await handler(req, params);
      }
      if (req.isResponded()) {
        return true;
      }
    }
    return false;
  }
  async function handleRouteInternal(
    parentMatch: string,
    req: ServerRequest
  ): Promise<void> {
    for (const handler of middlewareList) {
      await handler(req);
      if (req.isResponded()) {
        return;
      }
    }
    const subpath = req.path.slice(parentMatch.length) || "/";
    for (const { prefix, handlers } of prefixers) {
      if (subpath.startsWith(prefix)) {
        const match = subpath.match(new RegExp(`^${prefix}`));
        assert(match != null);
        if (
          await chainRoutes(
            parentMatch + prefix,
            req,
            { match },
            handlers
          )
        ) {
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
      if (await chainRoutes(parentMatch + match, req, { match }, handlers)) {
        return;
      }
      if (wsHandler && acceptable(req)) {
        const sock = await acceptWebSocket(req);
        req.markAsResponded(101);
        wsHandler(sock, req, { match });
      }
      if (!req.isResponded()) {
        throw new RoutingError(404);
      }
    } else {
      throw new RoutingError(404);
    }
  }
  const handleRoute = async (parentMatch: string, req: ServerRequest) => {
    try {
      await handleRouteInternal(parentMatch, req);
    } catch (e) {
      if (errorHandler) {
        await errorHandler(e, req);
        if (!req.isResponded()) {
          throw e;
        }
      } else {
        throw e;
      }
    } finally {
      finalHandler?.(req);
    }
  };
  return {
    handleRoute,
    use,
    handle,
    route,
    get,
    post,
    ws,
    catch: _catch,
    finally: _finally
  };
}
