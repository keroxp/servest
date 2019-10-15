// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import listen = Deno.listen;
import Conn = Deno.Conn;
import Reader = Deno.Reader;
import { BufReader, BufWriter } from "./vendor/https/deno.land/std/io/bufio.ts";
import { defer, promiseInterrupter } from "./promises.ts";
import { initServeOptions, readRequest } from "./serveio.ts";
import { createResponder, ServerResponder } from "./responder.ts";
import ListenOptions = Deno.ListenOptions;
import Listener = Deno.Listener;
import { BodyReader } from "./readers.ts";

/** request data for building http request to server */
export type ClientRequest = {
  /** full request url with queries */
  url: string;
  /** HTTP method */
  method: string;
  /** HTTP Headers */
  headers?: Headers;
  /** HTTP Body */
  body?: string | Uint8Array | Reader;
};

/** response data for building http response to client */
export type ServerResponse = {
  /** HTTP status code */
  status: number;
  /** HTTP headers */
  headers?: Headers;
  /** HTTP body */
  body?: string | Uint8Array | Reader;
};

/** Incoming http request for handling request from client */
export type IncomingHttpRequest = {
  /** request path with queries. always begin with / */
  url: string;
  /** HTTP method */
  method: string;
  /** requested protocol. like HTTP/1.1 */
  proto: string;
  /** HTTP Headers */
  headers: Headers;
  /** HTTP Body */
  body?: BodyReader;
  /** Trailer headers. Note that it won't be assigned until finalizer will be called */
  trailers?: Headers;
  /** keep-alive info */
  keepAlive?: KeepAlive;
  /** Request finalizer. Consume all body and trailers */
  finalize: () => Promise<void>;
};

export type KeepAlive = {
  timeout: number;
  max: number;
};

/** Outgoing http response for building request to server */
export type ServerRequest = IncomingHttpRequest & {
  conn: Conn;
  bufWriter: BufWriter;
  bufReader: BufReader;
} & ServerResponder;

/** Incoming http response for receiving from server */
export type IncomingHttpResponse = {
  /** requested protocol. like HTTP/1.1 */
  proto: string;
  /** request path with queries. always begin with / */
  status: number;
  /** status text. like OK */
  statusText: string;
  /** HTTP Headers */
  headers: Headers;
  /** HTTP Body */
  body?: BodyReader;
  /** trailer headers. Note that it won't be assigned until finalizer will be called */
  trailers?: Headers;
  /** Request finalizer. Consume all body and trailers */
  finalize: () => Promise<void>;
};

export type ClientResponse = IncomingHttpResponse & {
  conn: Conn;
  bufWriter: BufWriter;
  bufReader: BufReader;
};

/** serve options */
export type ServeOptions = {
  /** canceller promise for async iteration. use defer() */
  cancel?: Promise<void>;
  /** read timeout for keep-alive connection. ms. default=75000(ms) */
  keepAliveTimeout?: number;
  /** read timeout for all read request. ms. default=75000(ms) */
  readTimeout?: number;
};

export type ServeListener = Deno.Closer;

function createListener(listenOptions: string | ListenOptions): Listener {
  if (typeof listenOptions === "string") {
    const [h, p] = listenOptions.split(":");
    if (!p) {
      throw new Error("server: port must be specified");
    }
    listenOptions = { port: parseInt(p) };
    if (h) {
      listenOptions.hostname = h;
    }
    return listen(listenOptions);
  } else {
    return listen(listenOptions);
  }
}

export function listenAndServe(
  addr: string,
  handler: (req: ServerRequest) => Promise<void>,
  opts?: ServeOptions
): ServeListener;
export function listenAndServe(
  listenOptions: ListenOptions,
  handler: (req: ServerRequest) => Promise<void>,
  opts?: ServeOptions
): ServeListener;
export function listenAndServe(
  listenOptions: string | ListenOptions,
  handler: (req: ServerRequest) => Promise<void>,
  opts: ServeOptions = {}
): ServeListener {
  opts = initServeOptions(opts);
  let listener = createListener(listenOptions);
  let cancel: Promise<void>;
  let d = defer();
  if (opts.cancel) {
    cancel = Promise.race([opts.cancel, d.promise]);
  } else {
    cancel = d.promise;
  }
  const throwIfCancelled = promiseInterrupter({
    cancel
  });
  let closed = false;
  const close = () => {
    if (!closed) {
      d.resolve();
      listener.close();
      closed = true;
    }
  };
  const acceptRoutine = () => {
    if (closed) return;
    throwIfCancelled(listener.accept())
      .then(conn => {
        handleKeepAliveConn(conn, handler, opts);
        acceptRoutine();
      })
      .catch(close);
  };
  acceptRoutine();
  return { close };
}

/** Try to continually read and process requests from keep-alive connection. */
function handleKeepAliveConn(
  conn: Conn,
  handler: (req: ServerRequest) => Promise<void>,
  opts: ServeOptions = {}
) {
  const bufReader = new BufReader(conn);
  const bufWriter = new BufWriter(conn);
  const originalOpts = opts;
  // ignore keepAliveTimeout and use readTimeout for the first time
  scheduleReadRequest({
    keepAliveTimeout: opts.readTimeout,
    readTimeout: opts.readTimeout,
    cancel: opts.cancel
  });

  function scheduleReadRequest(opts: ServeOptions) {
    processRequest(opts)
      .then(scheduleReadRequest)
      .catch(() => conn.close());
  }

  async function processRequest(opts: ServeOptions): Promise<ServeOptions> {
    const req = await readRequest(bufReader, opts);
    const responder = createResponder(bufWriter);
    const nextReq: ServerRequest = {
      ...req,
      bufWriter,
      bufReader,
      conn,
      ...responder
    };
    await handler(nextReq);
    await req.finalize();
    let keepAliveTimeout = originalOpts.keepAliveTimeout;
    if (req.keepAlive && req.keepAlive.max <= 0) {
      throw Deno.EOF;
    }
    if (req.headers.get("connection") === "close") {
      throw Deno.EOF;
    }
    if (req.keepAlive) {
      keepAliveTimeout = Math.min(
        keepAliveTimeout!,
        req.keepAlive.timeout * 1000
      );
    }
    return {
      keepAliveTimeout,
      readTimeout: opts.readTimeout,
      cancel: opts.cancel
    };
  }
}
