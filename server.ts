// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { BufReader, BufWriter } from "./vendor/https/deno.land/std/io/bufio.ts";
import { deferred } from "./vendor/https/deno.land/std/async/mod.ts";
import { initServeOptions } from "./serveio.ts";
import { createResponder, Responder } from "./responder.ts";
import { promiseInterrupter, promiseWaitQueue } from "./_util.ts";
import { createDataHolder, DataHolder } from "./data_holder.ts";
import { BodyParser } from "./body_parser.ts";
import { classicAdapter, HttpApiAdapter, nativeAdapter } from "./_adapter.ts";

export type HttpBody =
  | string
  | Uint8Array
  | Deno.Reader
  | ReadableStream<Uint8Array>;

/** request data for building http request to server */
export interface ClientRequest {
  /** full request url with queries */
  url: string;
  /** HTTP method */
  method: string;
  /** HTTP Headers */
  headers?: Headers;
  /** HTTP Body */
  body?: HttpBody;
  /** HTTP Trailers setter. It will be after finishing writing body. */
  trailers?(): Promise<Headers> | Headers;
}

/** response data for building http response to client */
export interface ServerResponse {
  /** HTTP status code */
  status: number;
  /** HTTP headers */
  headers?: Headers;
  /** HTTP body */
  body?: HttpBody | null;
  /** HTTP Trailers setter. It will be after finishing writing body. */
  trailers?(): Promise<Headers> | Headers;
}

/** Incoming http request for handling request from client */
export interface IncomingRequest extends BodyParser {
  /** Raw requested URL (path + query): /path/to/resource?a=1&b=2 */
  url: string;
  /** Path part of url: /path/to/resource */
  path: string;
  /** Parsed query part of url: ?a=1&b=2 */
  query: URLSearchParams;
  /** HTTP method */
  method: string;
  /** requested protocol. like HTTP/1.1 */
  proto: string;
  /** HTTP Headers */
  headers: Headers;
  /** HTTP Body */
  body: BodyReader;
  /** Cookie */
  cookies: Map<string, string>;
  /** keep-alive info */
  keepAlive?: KeepAlive;
}

export interface KeepAlive {
  timeout: number;
  max: number;
}

/** Outgoing http response for building request to server */
export interface ServerRequest extends IncomingRequest, DataHolder, Responder {
  conn: Deno.Conn;
  bufWriter: BufWriter;
  bufReader: BufReader;
  /** Match result of path patterns */
  match: RegExpMatchArray;
}

/** Incoming http response from server to client */
export interface IncomingResponse extends BodyParser {
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
}

export interface BodyReader extends Deno.Reader {
  close(): Promise<void>;
}

export interface ClientResponse extends IncomingResponse {
  conn: Deno.Conn;
  bufWriter: BufWriter;
  bufReader: BufReader;
}

/** serve options */
export interface ServeOptions {
  /** canceller promise for async iteration. use defer() */
  cancel?: Promise<void>;
  /** read timeout for keep-alive connection. ms. default=75000(ms) */
  keepAliveTimeout?: number;
  /** read timeout for all read request. ms. default=75000(ms) */
  readTimeout?: number;
  /** use native http binding api (needs --unstable) */
  useNative?: boolean;
}

export type ServeListener = Deno.Closer;
export interface ServeHandler {
  (req: ServerRequest): void | Promise<void>;
}

function createListener(opts: {
  hostname?: string;
  port: number;
}): Deno.Listener {
  return Deno.listen({ ...opts, transport: "tcp" });
}

export function listenAndServeTls(
  listenOptions: Deno.ListenTlsOptions,
  handler: ServeHandler,
  opts?: ServeOptions,
): ServeListener {
  const listener = Deno.listenTls(listenOptions);
  return listenInternal(listener, handler, opts);
}

export function listenAndServe(
  listenOptions: Deno.ListenOptions,
  handler: ServeHandler,
  opts: ServeOptions = {},
): ServeListener {
  opts = initServeOptions(opts);
  const listener = createListener(listenOptions);
  return listenInternal(listener, handler, opts);
}

function listenInternal(
  listener: Deno.Listener,
  handler: ServeHandler,
  opts: ServeOptions = {},
): ServeListener {
  let cancel: Promise<void>;
  let d = deferred<void>();
  if (opts.cancel) {
    cancel = Promise.race([opts.cancel, d]);
  } else {
    cancel = d;
  }
  const throwIfCancelled = promiseInterrupter({
    cancel,
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
      .then((conn) => {
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
  conn: Deno.Conn,
  handler: ServeHandler,
  opts: ServeOptions = {},
): void {
  const bufReader = new BufReader(conn);
  const bufWriter = new BufWriter(conn);
  const originalOpts = opts;
  const adapter = opts.useNative
    ? nativeAdapter(conn)
    : classicAdapter({ conn, bufReader, bufWriter });
  const q = promiseWaitQueue<ServerResponse, void>(adapter.respond);
  // ignore keepAliveTimeout and use readTimeout for the first time
  scheduleReadRequest({
    keepAliveTimeout: opts.readTimeout,
    readTimeout: opts.readTimeout,
    cancel: opts.cancel,
  });

  async function scheduleReadRequest(opts: ServeOptions) {
    processRequest(adapter, opts)
      .then((v) => {
        if (v) scheduleReadRequest(v);
      })
      .catch(() => {
        adapter.close();
      });
  }

  async function processRequest(
    adapter: HttpApiAdapter,
    opts: ServeOptions,
  ): Promise<ServeOptions | undefined> {
    const baseReq = await adapter.next(opts);
    if (!baseReq) {
      throw new Error("connection closed");
    }
    let responded: Promise<void> = Promise.resolve();
    const responder = createResponder(async (resp) => {
      return responded = q.enqueue(resp);
    });
    const match = baseReq.url.match(/^\//);
    if (!match) {
      throw new Error("malformed url");
    }
    const dataHolder = createDataHolder();
    const req: ServerRequest = {
      bufWriter,
      bufReader,
      conn,
      ...baseReq,
      ...responder,
      ...dataHolder,
      match,
    };
    await handler(req);
    await responded;
    await req.body.close();
    if (req.respondedStatus() === 101) {
      // If upgraded, stop processing
      return;
    }
    let keepAliveTimeout = originalOpts.keepAliveTimeout;
    if (req.keepAlive && req.keepAlive.max <= 0) {
      throw new Error("keep-alive ended");
    }
    if (req.headers.get("connection") === "close") {
      throw new Error("connection closed header");
    }
    if (req.keepAlive) {
      keepAliveTimeout = Math.min(
        keepAliveTimeout!,
        req.keepAlive.timeout * 1000,
      );
    }
    return {
      keepAliveTimeout,
      readTimeout: opts.readTimeout,
      cancel: opts.cancel,
    };
  }
}
