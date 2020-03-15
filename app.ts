// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import {
  listenAndServe,
  listenAndServeTLS,
  ServeListener,
  ServeOptions
} from "./server.ts";
import { createLogger, Logger, Loglevel, namedLogger } from "./logger.ts";
import ListenOptions = Deno.ListenOptions;
import ListenTLSOptions = Deno.ListenTLSOptions;
import { createRouter, Router } from "./router.ts";

export interface App extends Router {
  /** Start listening with given addr */
  listen(addr: string | ListenOptions, opts?: ServeOptions): ServeListener;

  /** Start listening for HTTPS server */
  listenTLS(tlsOptions: ListenTLSOptions, opts?: ServeOptions): ServeListener;
}

export type AppOptions = {
  logger?: Logger;
  logLevel?: Loglevel;
};

/** Create App */
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
    const listener = listenAndServe(addr, router.handle, opts);
    logger.info(`listening on ${addr}`);
    return listener;
  }
  function listenTLS(
    listenOptions: ListenTLSOptions,
    opts?: ServeOptions
  ): ServeListener {
    const listener = listenAndServeTLS(listenOptions, router.handle, opts);
    logger.info(
      `listening on ${listenOptions.hostname || ""}:${listenOptions.port}`
    );
    return listener;
  }
  return { ...router, listen, listenTLS };
}
