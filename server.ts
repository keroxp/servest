// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { BufReader, BufWriter } from "./vendor/https/deno.land/std/io/bufio.ts";
import { createResponder, Responder } from "./responder.ts";
import { promiseWaitQueue } from "./_util.ts";
import { createDataHolder, DataHolder } from "./data_holder.ts";
import { BodyParser } from "./body_parser.ts";
import { HttpApiAdapter, nativeAdapter } from "./_adapter.ts";

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
  /** original event */
  event: Deno.RequestEvent;
}

/** Outgoing http response for building request to server */
export interface ServerRequest extends IncomingRequest, DataHolder, Responder {
  conn: Deno.Conn;
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
  /** abort signal for async iteration.  */
  signal?: AbortSignal;
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
  const listener = createListener(listenOptions);
  return listenInternal(listener, handler, opts);
}

function listenInternal(
  listener: Deno.Listener,
  handler: ServeHandler,
  opts: ServeOptions = {},
): ServeListener {
  let closed = false;
  const close = () => {
    if (!closed) {
      listener.close();
      closed = true;
    }
  };
  if (opts.signal) {
    opts.signal.addEventListener("abort", close);
  }
  const acceptRoutine = () => {
    if (closed) return;
    listener
      .accept()
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
  const adapter = nativeAdapter(conn);
  const q = promiseWaitQueue<ServerResponse, void>(adapter.respond);
  // ignore keepAliveTimeout and use readTimeout for the first time
  scheduleReadRequest();

  async function scheduleReadRequest() {
    processRequest(adapter, opts)
      .then(() => {
        scheduleReadRequest();
      })
      .catch(() => {
        adapter.close();
      });
  }

  async function processRequest(
    adapter: HttpApiAdapter,
    opts: ServeOptions,
  ): Promise<void> {
    const baseReq = await adapter.next(opts);
    if (!baseReq) {
      throw new Error("connection closed");
    }
    let responded: Promise<void> = Promise.resolve();
    const responder = createResponder(async (resp) => {
      return (responded = q.enqueue(resp));
    });
    const match = baseReq.url.match(/^\//);
    if (!match) {
      throw new Error("malformed url");
    }
    const dataHolder = createDataHolder();
    const req: ServerRequest = {
      conn,
      ...baseReq,
      ...responder,
      ...dataHolder,
      match,
    };
    await handler(req);
    await responded;
    await req.body.close();
  }
}
