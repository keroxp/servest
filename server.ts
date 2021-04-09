// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { BufReader, BufWriter } from "./vendor/https/deno.land/std/io/bufio.ts";
import { Deferred, deferred } from "./vendor/https/deno.land/std/async/mod.ts";
import { initServeOptions } from "./serveio.ts";
import { createResponder, Responder } from "./responder.ts";
import { promiseInterrupter, promiseWaitQueue } from "./_util.ts";
import { createDataHolder, DataHolder } from "./data_holder.ts";
import { BodyParser, createBodyParser } from "./body_parser.ts";
export interface RequestEvent {
  readonly request: Request;
  respondWith(r: Response | Promise<Response>): void;
}

export interface HttpConn extends AsyncIterable<RequestEvent> {
  readonly rid: number;

  nextRequest(): Promise<RequestEvent | null>;
  close(): void;
}

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
  body: Deno.Reader;
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
  const http: HttpConn = Deno.startHttp(conn);
  const bufReader = new BufReader(conn);
  const bufWriter = new BufWriter(conn);
  const originalOpts = opts;
  // ignore keepAliveTimeout and use readTimeout for the first time
  scheduleReadRequest({
    keepAliveTimeout: opts.readTimeout,
    readTimeout: opts.readTimeout,
    cancel: opts.cancel,
  });

  async function scheduleReadRequest(opts: ServeOptions) {
    processRequest(opts)
      .then((v) => {
        if (v) scheduleReadRequest(v);
      })
      .catch(() => {
        conn.close();
      });
  }

  async function processRequest(
    opts: ServeOptions,
  ): Promise<ServeOptions | undefined> {
    const responded: Deferred<ServerResponse> = deferred();
    const ev = await http.nextRequest();
    if (!ev) return;
    const responder = createResponder(async (resp) => {
      responded.resolve(resp);
    });
    const match = ev.request.url.match(/^\//);
    if (!match) {
      throw new Error("malformed url");
    }
    const dataHolder = createDataHolder();
    const baseReq = requestFromEvent(ev);
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
    const resp = await responded;
    const body = createStream(resp);
    await ev.respondWith(
      new Response(body, { status: resp.status, headers: resp.headers }),
    );
    // await ev.request.text();
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

function requestFromEvent(ev: RequestEvent): IncomingRequest {
  const { pathname, search, searchParams } = new URL(ev.request.url);
  const { method, headers } = ev.request;
  const contentType = headers.get("content-type") ?? "";
  let body: Deno.Reader;
  if (ev.request.body) {
    body = streamReader(ev.request.body);
  } else {
    body = {
      async read() {
        return null;
      },
    };
  }
  const bodyParser = createBodyParser({
    reader: body,
    contentType,
  });
  return {
    url: pathname + search,
    path: pathname,
    query: searchParams,
    method,
    proto: "HTTP/1.1",
    headers,
    cookies: new Map(),
    body,
    ...bodyParser,
  };
}

function streamReader(stream: ReadableStream<Uint8Array>): Deno.Reader {
  const reader = stream.getReader();
  async function read(buf: Uint8Array): Promise<number | null> {
    const result = await reader.read();
    if (result.value) {
      const read = Math.min(result.value.byteLength, buf.byteLength);
      buf.set(result.value.subarray(0, read));
      return read;
    } else {
      return null;
    }
  }
  return { read };
}

const encoder = new TextEncoder();
function noopStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(ctrl) {
      ctrl.close();
    },
  });
}
function createStream(resp: ServerResponse): ReadableStream<Uint8Array> {
  const { body, trailers } = resp;
  if (!body) {
    return noopStream();
  }
  // TODO: trailer
  if (body instanceof ReadableStream) {
    return body;
  } else if (body instanceof Uint8Array) {
    return new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(body);
        ctrl.close();
      },
    });
  } else if (typeof body === "string") {
    return new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(encoder.encode(body));
        ctrl.close();
      },
    });
  } else {
    const buf = new Uint8Array(2048);
    return new ReadableStream<Uint8Array>({
      async pull(ctrl) {
        const len = await body.read(buf);
        if (len != null) {
          ctrl.enqueue(buf.subarray(0, len));
        } else {
          ctrl.close();
        }
      },
    });
  }
}
