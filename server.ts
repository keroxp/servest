// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import Conn = Deno.Conn;
import Reader = Deno.Reader;
import { BufReader, BufWriter } from "./vendor/https/deno.land/std/io/bufio.ts";
import { promiseInterrupter } from "./promises.ts";
import { deferred } from "./vendor/https/deno.land/std/util/async.ts";
import { initServeOptions, readRequest, writeResponse } from "./serveio.ts";
import { createResponder, ServerResponder } from "./responder.ts";
import ListenOptions = Deno.ListenOptions;
import Listener = Deno.Listener;
import { BodyReader } from "./readers.ts";
import ListenTLSOptions = Deno.ListenTLSOptions;
import { promiseWaitQueue } from "./util.ts";

export type HttpBody = string | Uint8Array | Reader;
/** request data for building http request to server */
export type ClientRequest = {
  /** full request url with queries */
  url: string;
  /** HTTP method */
  method: string;
  /** HTTP Headers */
  headers?: Headers;
  /** HTTP Body */
  body?: HttpBody;
  /** HTTP Trailers setter. It will be after finishing writing body. */
  trailers?: () => Promise<Headers> | Headers;
};

/** response data for building http response to client */
export type ServerResponse = {
  /** HTTP status code */
  status: number;
  /** HTTP headers */
  headers?: Headers;
  /** HTTP body */
  body?: HttpBody;
  /** HTTP Trailers setter. It will be after finishing writing body. */
  trailers?: () => Promise<Headers> | Headers;
};

/** Incoming http request for handling request from client */
export type IncomingHttpRequest = {
  /** Raw requested URL (path + query): /path/to/resource?a=1&b=2 */
  url: string;
  /** Path part of url: /path/to/resource */
  path: string;
  /** Query part of url: ?a=1&b=2 */
  query: URLSearchParams;
  /** HTTP method */
  method: string;
  /** requested protocol. like HTTP/1.1 */
  proto: string;
  /** HTTP Headers */
  headers: Headers;
  /** HTTP Body */
  body?: BodyReader;
  /** Cookie */
  cookies: Map<string, string>;
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
  body: BodyReader;
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
export type ServeHandler = (req: ServerRequest) => Promise<void>;
export type HostPort = { hostname?: string; port: number };
function createListener(listenOptions: string | HostPort): Listener {
  if (typeof listenOptions === "string") {
    const [h, p] = listenOptions.split(":");
    if (!p) {
      throw new Error("server: port must be specified");
    }
    const opts: HostPort = { port: parseInt(p) };
    if (h) {
      opts.hostname = h;
    }
    return Deno.listen({ ...opts, transport: "tcp" });
  } else {
    return Deno.listen({ ...listenOptions, transport: "tcp" });
  }
}

export function listenAndServeTLS(
  listenOptions: ListenTLSOptions,
  handler: ServeHandler,
  opts?: ServeOptions
): ServeListener {
  const listener = Deno.listenTLS(listenOptions);
  return listenInternal(listener, handler, opts);
}

export function listenAndServe(
  listenOptions: string | ListenOptions,
  handler: ServeHandler,
  opts: ServeOptions = {}
): ServeListener {
  opts = initServeOptions(opts);
  const listener = createListener(listenOptions);
  return listenInternal(listener, handler, opts);
}

function listenInternal(
  listener: Listener,
  handler: ServeHandler,
  opts: ServeOptions = {}
): ServeListener {
  let cancel: Promise<void>;
  let d = deferred<void>();
  if (opts.cancel) {
    cancel = Promise.race([opts.cancel, d]);
  } else {
    cancel = d;
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
export function handleKeepAliveConn(
  conn: Conn,
  handler: ServeHandler,
  opts: ServeOptions = {}
): void {
  const bufReader = new BufReader(conn);
  const bufWriter = new BufWriter(conn);
  const originalOpts = opts;
  const q = promiseWaitQueue<ServerResponse, void>(resp =>
    writeResponse(bufWriter, resp)
  );

  // ignore keepAliveTimeout and use readTimeout for the first time
  scheduleReadRequest({
    keepAliveTimeout: opts.readTimeout,
    readTimeout: opts.readTimeout,
    cancel: opts.cancel
  });

  function scheduleReadRequest(opts: ServeOptions) {
    processRequest(opts)
      .then(v => {
        if (v) scheduleReadRequest(v);
      })
      .catch(() => {
        conn.close();
      });
  }

  async function processRequest(
    opts: ServeOptions
  ): Promise<ServeOptions | undefined> {
    const baseReq = await readRequest(bufReader, opts);
    let responded: Promise<void> = Promise.resolve();
    const onResponse = (resp: ServerResponse) => {
      responded = q.enqueue(resp);
      return responded;
    };
    const responder = createResponder(bufWriter, onResponse);
    const req: ServerRequest = {
      ...baseReq,
      bufWriter,
      bufReader,
      conn,
      ...responder
    };
    await handler(req);
    await responded;
    await req.finalize();
    if (req.respondedStatus() === 101) {
      // If upgraded, stop processing
      return;
    }
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
