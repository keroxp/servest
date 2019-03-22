// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import listen = Deno.listen;
import Conn = Deno.Conn;
import Reader = Deno.Reader;
import { BufReader, BufWriter } from "https://deno.land/std@v0.3.2/io/bufio.ts";
import { assert } from "https://deno.land/std@v0.3.2/testing/asserts.ts";
import { defer, promiseInterrupter } from "./promises.ts";
import { readRequest } from "./serveio.ts";
import { createResponder, ServerResponder } from "./responder.ts";

/** request data for building http request to server */
export type ClientRequest = {
  /** full request url with queries */
  url: string;
  /** HTTP method */
  method: string;
  /** HTTP Headers */
  headers: Headers;
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

const kDefaultKeepAliveTimeout = 75000;

export async function* serve(
  addr: string,
  opts?: ServeOptions
): AsyncIterableIterator<ServerRequest> {
  let cancel = defer().promise;
  let keepAliveTimeout = kDefaultKeepAliveTimeout;
  let readTimeout = kDefaultKeepAliveTimeout;
  if (opts) {
    if (opts.cancel) {
      cancel = opts.cancel;
    }
    if (opts.keepAliveTimeout !== void 0) {
      keepAliveTimeout = opts.keepAliveTimeout;
    }
    if (opts.readTimeout !== void 0) {
      readTimeout = opts.readTimeout;
    }
  }
  assert(keepAliveTimeout >= 0, "keepAliveTimeout must be >= 0");
  const listener = listen("tcp", addr);
  let onRequestDeferred = defer<ServerRequest>();
  const breakWhenCancelled = promiseInterrupter({ timeout: -1, cancel });
  // start accept routine
  // it continually accept new tcp socket
  (async function acceptRoutine() {
    while (true) {
      let conn: Conn;
      try {
        conn = await breakWhenCancelled(listener.accept());
      } catch (unused) {
        break;
      }
      const bufReader = new BufReader(conn);
      const bufWriter = new BufWriter(conn);
      // start read first request
      readRequest(bufReader, {
        keepAliveTimeout: readTimeout,
        readTimeout,
        cancel
      })
        .then(req => {
          onRequestDeferred.resolve(
            Object.assign(
              req,
              { bufWriter, bufReader, conn },
              createResponder(bufWriter)
            )
          );
        })
        .catch(e => {
          conn.close();
        });
    }
  })();
  while (true) {
    let req: ServerRequest;
    try {
      // break loop if canceller is called
      req = await breakWhenCancelled(onRequestDeferred.promise);
    } catch (unused) {
      break;
    }
    onRequestDeferred = defer();
    yield req;
    (async () => {
      await req.finalize();
      let _keepAliveTimeout = keepAliveTimeout;
      if (req.keepAlive && req.keepAlive.max <= 0) {
        req.conn.close();
        return;
      }
      if (req.headers.get("connection") === "close") {
        req.conn.close();
        return;
      }
      if (req.keepAlive && Number.isInteger(req.keepAlive.timeout)) {
        _keepAliveTimeout = Math.min(
          _keepAliveTimeout,
          req.keepAlive.timeout * 1000
        );
      }
      const nextReq = await readRequest(req.bufReader, {
        keepAliveTimeout: _keepAliveTimeout,
        readTimeout,
        cancel
      });
      const { bufWriter, bufReader, conn } = req;
      onRequestDeferred.resolve(
        Object.assign(
          nextReq,
          { bufWriter, bufReader, conn },
          createResponder(req.bufWriter)
        )
      );
    })().catch(e => req.conn.close());
  }
  listener.close();
}
