// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import {
  listenAndServe,
  listenAndServeTLS,
  ServeListener,
  ServeOptions,
  ServerRequest
} from "./server.ts";
import { createLogger, Logger, Loglevel, namedLogger } from "./logger.ts";
import ListenOptions = Deno.ListenOptions;
import ListenTLSOptions = Deno.ListenTLSOptions;
import {
  createRouter,
  Router
} from "./router.ts";
import { RoutingError } from "./error.ts";
import { kHttpStatusMessages } from "./serveio.ts";

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
  const { info, error } = namedLogger("servest:router", opts.logger);
  const router = createRouter();
  const finalErrorHandler = async (e: any, req: ServerRequest) => {
    if (e instanceof RoutingError) {
      await req.respond({
        status: e.status,
        body: e.message
      });
    } else {
      if (e instanceof Error) {
        await req.respond({
          status: 500,
          body: e.stack
        });
        if (e.stack) {
          error(e.stack);
        }
      } else {
        await req.respond({
          status: 500,
          body: kHttpStatusMessages[500]
        });
        error(e);
      }
    }
  };
  const handleRoute = async (p: string, req: ServerRequest) => {
    try {
      await router.handleRoute(p, req);
    } catch (e) {
      if (!req.isResponded()) {
        await finalErrorHandler(e, req);
      }
    } finally {
      if (!req.isResponded()) {
        await finalErrorHandler(new RoutingError(404), req);
      }
      info(`${req.respondedStatus()} ${req.method} ${req.url}`);
    }
  };
  function listen(
    addr: string | ListenOptions,
    opts?: ServeOptions
  ): ServeListener {
    const listener = listenAndServe(addr, req => handleRoute("", req), opts);
    info(`listening on ${addr}`);
    return listener;
  }
  function listenTLS(
    listenOptions: ListenTLSOptions,
    opts?: ServeOptions
  ): ServeListener {
    const listener = listenAndServeTLS(
      listenOptions,
      req => handleRoute("", req),
      opts
    );
    info(`listening on ${listenOptions.hostname || ""}:${listenOptions.port}`);
    return listener;
  }
  return { ...router, handleRoute, listen, listenTLS };
}
