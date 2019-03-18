// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import listen = Deno.listen;
import Conn = Deno.Conn;
import Reader = Deno.Reader;
import { BufReader, BufWriter } from "https://deno.land/std@v0.3.1/io/bufio.ts";
import { assert } from "https://deno.land/std@v0.3.1/testing/asserts.ts";
import { defer, promiseInterrupter } from "./promises.ts";
import { readRequest } from "./serveio.ts";

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
export type IncomingHttpRequestBase = {
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
  /** Request finalizer. Consume all body and trailers */
  finalize: () => Promise<void>;
};

/** Outgoing http response for building request to server */
export type IncomingHttpRequest = IncomingHttpRequestBase & {
  conn: Conn;
  bufWriter: BufWriter;
  bufReader: BufReader;
};

/** Incoming http response for receiving from server */
export type IncomingHttpResponseBase = {
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

export type IncomingHttpResponse = IncomingHttpRequestBase & {
  conn: Conn;
  bufWriter: BufWriter;
  bufReader: BufReader;
};

/** serve options */
export type ServeOptions = {
  /** canceller promise for async iteration. use defer() */
  cancel?: Promise<void>;
  /** read timeout for keep-alive connection in sec. default=75 */
  keepAliveTimeout?: number;
  /** read timeout for all read request. default=75 */
  readTimeout?: number;
};

export async function* serve(
  addr: string,
  opts?: ServeOptions
): AsyncIterableIterator<IncomingHttpRequest> {
  let cancel = defer().promise;
  let keepAliveTimeout = 7500;
  let readTimeout = 7500;
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
  let onRequestDeferred = defer<IncomingHttpRequest>();
  const breakWhenCancelled = promiseInterrupter({ timeout: -1, cancel });
  const handleRequest = ({ bufReader, bufWriter, conn }, forNext: boolean) => {
    readRequest(bufReader, {
      keepAliveTimeout: forNext ? keepAliveTimeout : readTimeout,
      readTimeout,
      cancel
    })
      .then(req => {
        onRequestDeferred.resolve(
          Object.assign(req, {
            bufWriter,
            bufReader,
            conn
          })
        );
      })
      .catch(e => {
        conn.close();
      });
  };
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
      handleRequest({ conn, bufReader, bufWriter }, false);
    }
  })();
  while (true) {
    let req: IncomingHttpRequest;
    try {
      // break loop if canceller is called
      req = await breakWhenCancelled(onRequestDeferred.promise);
    } catch (unused) {
      break;
    }
    onRequestDeferred = defer();
    yield req;
    req
      .finalize()
      .then(() => handleRequest(req, true))
      .catch(e => req.conn.close());
  }
  listener.close();
}
