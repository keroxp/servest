import {
  findLongestAndNearestMatches
} from "./matcher.ts";
import { ServerRequest, ServeHandler } from "./server.ts";
import { RoutingError } from "./error.ts";
import {
  acceptWebSocket,
  acceptable,
  WebSocket
} from "./vendor/https/deno.land/std/ws/mod.ts";
import { assert } from "./vendor/https/deno.land/std/testing/asserts.ts";

/** Router handler */
export interface RouteHandler<T extends KV = {}> {
  (req: ServerRequest, params: T & RouteParams): void | Promise<void>;
}

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

export interface Route {
  // internal
  handleRoute(prefix: string, req: ServerRequest): Promise<void>;
}

function isRoute(x: any): x is Route {
  return typeof x?.handleRoute === "function";
}

type KV = { [key: string]: any };
export type RequestMapper<T extends KV> = (req: ServerRequest) => T | Promise<
  T
>;

export interface Router<T extends KV = {}> extends Route {
  /**
   * Set global middleware.
   * It will be called for each request on any routes.
   * */
  use(middleware: ServeHandler): void;

  /**
   * Register route with given pattern.
   * It will be called for every http method,
   * Examples:
   *   router.handle("/", ...)   => Called if request path exactly matches "/".
   *   router.handle(/^\//, ...) => Called if request path matches given regexp.
   * */
  handle(pattern: string | RegExp, ...handlers: RouteHandler<T>[]): void;

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
  route(prefix: string, ...handlers: (RouteHandler<T> | Router<any>)[]): void;

  /**
   * Register GET route. This is shortcut for handle();
   * Handlers will be called on GET and HEAD method.
   * */
  get(pattern: string | RegExp, ...handlers: RouteHandler<T>[]): void;

  /** Register POST route. This is shortcut for handle() */
  post(pattern: string | RegExp, ...handlers: RouteHandler<T>[]): void;

  /** Accept ws upgrade */
  ws(pattern: string | RegExp, handler: WebSocketHandler): void;
  ws(
    pattern: string | RegExp,
    handlers: RouteHandler<T>[],
    handler: WebSocketHandler
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

interface RouterBuilder<T extends {}> {
  use<P extends KV>(mapper: RequestMapper<P>): RouterBuilder<T & P>;
  build(): Router<T>;
}

function composeMapper<T extends KV, P extends KV>(
  base: RequestMapper<T>,
  add: RequestMapper<P>
): RequestMapper<T & P> {
  return async (req) => {
    const b = await base(req);
    const e = await add(req);
    return { ...b, ...e };
  };
}

export function createRouterBuilder(): RouterBuilder<{}> {
  return _createRouterBuilder(() => ({}));
}

function _createRouterBuilder<T extends KV>(
  mapper: RequestMapper<T>
): RouterBuilder<T> {
  function use<P extends KV>(add: RequestMapper<P>): RouterBuilder<T & P> {
    return _createRouterBuilder(composeMapper(mapper, add));
  }
  function build(): Router<T> {
    return _createRouter({ mapper });
  }
  return { use, build };
}

export function createRouter(): Router {
  return _createRouter({ mapper: () => ({}) });
}

function _createRouter<T extends KV>(opts: {
  mapper: RequestMapper<T>;
}): Router<T> {
  const middlewareList: ServeHandler[] = [];
  const mapper = opts.mapper;
  const routes: {
    pattern: string | RegExp;
    methods?: string[];
    handlers: RouteHandler<any>[];
    wsHandler?: WebSocketHandler;
  }[] = [];
  const prefixers: {
    prefix: string;
    handlers: RouteHandler<any>[];
  }[] = [];

  let errorHandler: ErrorHandler | undefined;
  let finalHandler: ServeHandler | undefined;

  function use(...handlers: ServeHandler[]) {
    middlewareList.push(...handlers);
  }

  function handle(pattern: string | RegExp, ...handlers: RouteHandler<T>[]) {
    routes.push({ pattern, handlers });
  }

  function route(prefix: string, ...handlers: RouteHandler<T>[]) {
    prefixers.push({ prefix, handlers });
  }

  function get(pattern: string | RegExp, ...handlers: RouteHandler<T>[]) {
    routes.push({
      pattern,
      methods: ["GET", "HEAD"],
      handlers
    });
  }

  function post(pattern: string | RegExp, ...handlers: RouteHandler<T>[]) {
    routes.push({ pattern, methods: ["POST"], handlers });
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
    params: T & RouteParams,
    handlers: (RouteHandler<T> | Router<T>)[]
  ): Promise<boolean> {
    for (const handler of handlers) {
      if (isRoute(handler)) {
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
    const params = await mapper(req);
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
            { match, ...params },
            handlers
          )
        ) {
          return;
        }
      }
    }
    const matches = findLongestAndNearestMatches(
      subpath,
      routes.map(v => v.pattern)
    );
    if (matches.length > 0) {
      for (const [i, match] of matches) {
        const { methods, handlers, wsHandler } = routes[i];
        if (methods && !methods.includes(req.method)) {
          continue;
        }
        if (
          await chainRoutes(
            parentMatch + match,
            req,
            { match, ...params },
            handlers
          )
        ) {
          return;
        }
        if (wsHandler && acceptable(req)) {
          const sock = await acceptWebSocket(req);
          req.markAsResponded(101);
          wsHandler(sock, req, { match });
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
    ws,
    catch: _catch,
    finally: _finally
  };
}
