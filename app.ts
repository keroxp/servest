// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import {
  listenAndServe,
  listenAndServeTLS,
  ServeHandler,
  ServeListener,
  ServeOptions,
  ServerRequest
} from "./server.ts";
import { RoutingError } from "./error.ts";
import { kHttpStatusMessages } from "./serveio.ts";
import { createLogger, Logger, Loglevel, namedLogger } from "./logger.ts";
import ListenOptions = Deno.ListenOptions;
import ListenTLSOptions = Deno.ListenTLSOptions;
import {
  WebSocket
} from "./vendor/https/deno.land/std/ws/mod.ts";
import { createRouter, Router } from "./router.ts";

export interface App extends Router {
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
  req: RoutedServerRequest
) => void | Promise<void>;

/** Global error handler for requests */
export type ErrorHandler = (
  e: any | RoutingError,
  req: ServerRequest
) => void | Promise<void>;

export type AppOptions = {
  logger?: Logger;
  logLevel?: Loglevel;
};

/** Create HttpRouter */
export function createApp(
  opts: AppOptions = {
    logger: createLogger()
  }
): App {
  const logger = namedLogger("servest:router", opts.logger);
  const router = createRouter({ logger });
  function listen(
    addr: string | ListenOptions,
    opts?: ServeOptions
  ): ServeListener {
    const listener = listenAndServe(addr, req => router(req), opts);
    logger.info(`listening on ${addr}`);
    return listener;
  }
  function listenTLS(
    listenOptions: ListenTLSOptions,
    opts?: ServeOptions
  ): ServeListener {
    const listener = listenAndServeTLS(listenOptions, router, opts);
    logger.info(
      `listening on ${listenOptions.hostname || ""}:${listenOptions.port}`
    );
    return listener;
  }
  return Object.assign(router, { listen, listenTLS });
}
