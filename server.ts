// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import listen = Deno.listen;
import Conn = Deno.Conn;
import Reader = Deno.Reader;
import { BufReader, BufWriter } from "https://deno.land/std@v0.3.1/io/bufio.ts";
import { assert } from "https://deno.land/std@v0.3.1/testing/asserts.ts";
import { defer, promiseInterrupter } from "./promises.ts";
import { readRequest } from "./serveio.ts";

export type ServerResponse = {
  status: number;
  headers?: Headers;
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

function isConn(x): x is Conn {
  return typeof x === "object" && x.hasOwnProperty("rid");
}

function isIncomingHttpRequest(x): x is IncomingHttpRequest {
  return typeof x === "object" && x.hasOwnProperty("url");
}

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
  let canceled = false;
  let onRequestDeferred = defer<IncomingHttpRequest>();
  const rejectCancel = promiseInterrupter({ timeout: -1, cancel });
  (async function acceptRoutine() {
    while (!canceled) {
      let conn: Conn;
      try {
        conn = await rejectCancel(listener.accept());
      } catch (unused) {
        break;
      }
      const bufReader = new BufReader(conn);
      const bufWriter = new BufWriter(conn);
      (async () => {
        try {
          const req = await readRequest(bufReader, {
            keepAliveTimeout: readTimeout,
            readTimeout,
            cancel
          });
          onRequestDeferred.resolve(
            Object.assign(req, {
              bufWriter,
              bufReader,
              conn
            })
          );
        } catch (unused) {
          conn.close();
        }
      })();
    }
  })();
  while (true) {
    let req: IncomingHttpRequest;
    try {
      req = await rejectCancel(onRequestDeferred.promise);
    } catch (unused) {
      break;
    }
    onRequestDeferred = defer();
    if (!isIncomingHttpRequest(req)) {
      break;
    }
    yield req;
    (async function prepareForNext() {
      const { bufWriter, bufReader, conn, finalize } = req;
      try {
        await finalize();
        const nextReq = await readRequest(bufReader, {
          keepAliveTimeout,
          readTimeout,
          cancel
        });
        onRequestDeferred.resolve(
          Object.assign(nextReq, { bufWriter, bufReader, conn })
        );
      } catch (unused) {
        conn.close();
      }
    })();
  }
  canceled = true;
  listener.close();
}
