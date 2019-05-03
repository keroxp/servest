// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import listen = Deno.listen;
import Conn = Deno.Conn;
import Reader = Deno.Reader;
import { BufReader, BufWriter } from "https://deno.land/std@v0.3.4/io/bufio.ts";
import { defer, Deferred, promiseInterrupter } from "./promises.ts";
import { initServeOptions, readRequest } from "./serveio.ts";
import { createResponder, ServerResponder } from "./responder.ts";

/** request data for building http request to server */
export type ClientRequest = {
  /** full request url with queries */
  url: string;
  /** HTTP method */
  method: string;
  /** HTTP Headers */
  headers?: Headers;
  /** HTTP Body */
  body?: Uint8Array | Reader;
};

/** response data for building http response to client */
export type ServerResponse = {
  /** HTTP status code */
  status: number;
  /** HTTP headers */
  headers?: Headers;
  /** HTTP body */
  body?: Uint8Array | Reader;
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
  body?: Reader;
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
  body?: Reader;
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

export async function* serve(
  addr: string,
  opts: ServeOptions = {}
): AsyncIterableIterator<ServerRequest> {
  opts = initServeOptions(opts);
  const listener = listen("tcp", addr);
  let onRequestDeferred = defer();
  let requestQueue: ServerRequest[] = [];
  const yieldingPromises: WeakMap<ServerRequest, Deferred> = new WeakMap();
  const throwIfCancelled = promiseInterrupter({
    cancel: opts.cancel
  });
  const enqueueRequest = (req: ServerRequest): Promise<void> => {
    requestQueue.push(req);
    const d = defer();
    yieldingPromises.set(req, d);
    onRequestDeferred.resolve();
    return d.promise;
  };
  let closed = false;
  const closeListener = () => {
    if (!closed) {
      listener.close();
      closed = true;
    }
  };
  // start accept routine
  // it continually accept new tcp socket
  const acceptRoutine = () => {
    if (closed) return;
    listener
      .accept()
      .then(conn => {
        handleKeepAliveConn(conn, enqueueRequest, opts);
        acceptRoutine();
      })
      .catch(closeListener);
  };
  acceptRoutine();
  while (true) {
    try {
      // break loop if canceller is called
      await throwIfCancelled(onRequestDeferred.promise);
      onRequestDeferred = defer();
      const list = requestQueue;
      requestQueue = [];
      for (const req of list) {
        const d = yieldingPromises.get(req);
        try {
          yield req;
          d.resolve();
        } catch (e) {
          d.reject();
        } finally {
          yieldingPromises.delete(req);
        }
      }
    } catch (unused) {
      break;
    }
  }
  closeListener();
}

export function listenAndServe(
  addr: string,
  handler: (req: ServerRequest) => Promise<void>,
  opts: ServeOptions = {}
): void {
  opts = initServeOptions(opts);
  const listener = listen("tcp", addr);
  const throwIfCancelled = promiseInterrupter({
    cancel: opts.cancel
  });
  let closed = false;
  const closeListener = () => {
    if (!closed) {
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
      .catch(closeListener);
  };
  acceptRoutine();
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
    const nextReq = Object.assign(
      req,
      {
        bufWriter,
        bufReader,
        conn
      },
      createResponder(bufWriter)
    );
    await handler(nextReq);
    await req.finalize();
    let keepAliveTimeout = originalOpts.keepAliveTimeout;
    if (req.keepAlive && req.keepAlive.max <= 0) {
      throw "EOF";
    }
    if (req.headers.get("connection") === "close") {
      throw "EOF";
    }
    if (req.keepAlive && Number.isInteger(req.keepAlive.timeout)) {
      keepAliveTimeout = Math.min(
        keepAliveTimeout,
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
