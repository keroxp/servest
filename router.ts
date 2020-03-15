import {
  RoutedServerRequest,
  HttpHandler,
  WebSocketHandler,
  ErrorHandler
} from "./app.ts";
import { findLongestAndNearestMatch } from "./router_util.ts";
import { ServerRequest, ServeHandler } from "./server.ts";
import { kHttpStatusMessages } from "./serveio.ts";
import { RoutingError } from "./error.ts";
import {
  acceptWebSocket,
  acceptable
} from "./vendor/https/deno.land/std/ws/mod.ts";
import { namedLogger, NamedLogger } from "./logger.ts";
import { methodFilter } from "./middleware.ts";

export interface Router extends ServeHandler {
  /**
   * 
   */
  handleRequest(parentMatch: string, req: RoutedServerRequest): Promise<void>;
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
}

function isRouter(x: any): x is Router {
  return x != null && typeof x === "object" && typeof x.use === "function";
}

export function createRouter(opts?: {
  logger?: NamedLogger;
}): Router {
  const { info, error } = opts?.logger ?? namedLogger("servest:router");
  const middlewareList: HttpHandler[] = [];
  const routes: {
    pattern: string | RegExp;
    handlers: HttpHandler[];
    wsHandler?: WebSocketHandler;
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

  function handlerToString(handlers: HttpHandler[]): string {
    return handlers.map(v => {
      if (isRouter(v)) return "Router";
      else return v.name;
    }).join(" ");
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

  async function handleRequest(parentMatch: string, req: ServerRequest) {
    for (const handler of middlewareList) {
      if (isRouter(handler)) {
        await handler.handleRequest(parentMatch, { ...req, match: [] });
      } else {
        await handler({ ...req, match: [] });
      }
      if (req.isResponded()) {
        logRouteStatus(req, req.respondedStatus()!);
        return;
      }
    }
    const subpath = req.path.slice(parentMatch.length) || "/";
    console.log(`parentMatsh=${parentMatch} req.path=${req.path} subpath=${subpath}`);
    const { index, match } = findLongestAndNearestMatch(
      subpath,
      routes.map(v => v.pattern)
    );
    console.log(req.url, match);
    if (index > -1 && match) {
      const { handlers, wsHandler } = routes[index];
      const routedReq = { ...req, match };
      for (const handler of handlers) {
        if (isRouter(handler)) {
          await handler.handleRequest(parentMatch + match, routedReq);
        } else {
          await handler(routedReq);
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
  const ret = async (req: ServerRequest) => {
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
    await handleRequest("", req).catch(onError);
  };
  return Object.assign(
    ret,
    { handle, use, get, post, ws, handleError, handleRequest }
  );
}
