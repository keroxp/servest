// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { findLongestAndNearestMatches } from "./_matcher.ts";
import { ServeHandler, ServerRequest } from "./server.ts";
import { RoutingError } from "./error.ts";
import { assert } from "./vendor/https/deno.land/std/testing/asserts.ts";
import * as ws from "./vendor/https/deno.land/std/ws/mod.ts";
import { upgradeWebSocket } from "./ws.ts";

/** Router handler */
export interface RouteHandler {
  (req: ServerRequest): void | Promise<void>;
}

/** WebSocket Handler */
export interface WebSocketHandler {
  (sock: ws.WebSocket, req: ServerRequest): void | Promise<void>;
}

/** Global error handler for requests */
export interface ErrorHandler {
  (e: any | RoutingError, req: ServerRequest): void | Promise<void>;
}

export interface Route {
  // internal
  handleRoute(prefix: string, req: ServerRequest): Promise<void>;
}

function isRoute(x: any): x is Route {
  return typeof x?.handleRoute === "function";
}

export interface Router extends Route {
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
   * Register GET/HEAD route. This is shortcut for handle();
   * */
  get(pattern: string | RegExp, ...handlers: RouteHandler[]): void;

  /** Register POST route. This is shortcut for handle() */
  post(pattern: string | RegExp, ...handlers: RouteHandler[]): void;

  /** Register PUT route  */
  put(pattern: string | RegExp, ...handlers: RouteHandler[]): void;

  /** Register DELETE route  */
  delete(pattern: string | RegExp, ...handlers: RouteHandler[]): void;

  /** Register OPTIONS route */
  options(pattern: string | RegExp, ...handlers: RouteHandler[]): void;

  /** Accept ws upgrade */
  ws(pattern: string | RegExp, handler: WebSocketHandler): void;
  ws(
    pattern: string | RegExp,
    handlers: RouteHandler[],
    handler: WebSocketHandler,
  ): void;

  /**
   * Set global error handler.
   * All unhandled promise rejections occured on processing requests will be passed .
   * Only one handler can be set for one router.
   */
  catch(handler: ErrorHandler): void;

  /**
   * Set global finalizer.
   * Every request will reach this handler.
   * Note that request may already has been responded by other handlers.
   * Only one handler can be set for one router.
   */
  finally(handler: ServeHandler): void;
}

export function createRouter(): Router {
  const middlewareList: ServeHandler[] = [];
  const routes: {
    pattern: string | RegExp;
    methods?: string[];
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
      methods: ["GET", "HEAD"],
      handlers,
    });
  }

  function post(pattern: string | RegExp, ...handlers: RouteHandler[]) {
    routes.push({ pattern, methods: ["POST"], handlers });
  }

  function put(pattern: string | RegExp, ...handlers: RouteHandler[]) {
    routes.push({ pattern, methods: ["PUT"], handlers });
  }

  function _delete(pattern: string | RegExp, ...handlers: RouteHandler[]) {
    routes.push({ pattern, methods: ["DELETE"], handlers });
  }

  function options(pattern: string | RegExp, ...handlers: RouteHandler[]) {
    routes.push({ pattern, methods: ["OPTIONS"], handlers });
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
    handlers: (RouteHandler | Router)[],
  ): Promise<boolean> {
    for (const handler of handlers) {
      if (isRoute(handler)) {
        await handler.handleRoute(prefix, req);
      } else {
        await handler(req);
      }
      if (req.isResponded()) {
        return true;
      }
    }
    return false;
  }
  async function handleRouteInternal(
    parentMatch: string,
    req: ServerRequest,
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
        req.match = match;
        if (await chainRoutes(parentMatch + prefix, req, handlers)) {
          return;
        }
      }
    }
    const matches = findLongestAndNearestMatches(
      subpath,
      routes.map((v) => v.pattern),
    );
    if (matches.length > 0) {
      for (const [i, match] of matches) {
        const { methods, handlers, wsHandler } = routes[i];
        if (methods && !methods.includes(req.method)) {
          continue;
        }
        req.match = match;
        if (await chainRoutes(parentMatch + match, req, handlers)) {
          return;
        }
        if (wsHandler) {
          const sock = await upgradeWebSocket(req);
          if (sock) {
            req.markAsResponded(101);
            wsHandler(sock, req);
          } else {
            req.respond({ status: 400 });
            return;
          }
        }
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
    options,
    put,
    delete: _delete,
    ws,
    catch: _catch,
    finally: _finally,
  };
}
