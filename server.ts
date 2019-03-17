// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import listen = Deno.listen;
import Conn = Deno.Conn;
import Reader = Deno.Reader;
import { BufReader, BufWriter } from "https://deno.land/std@v0.3.1/io/bufio.ts";
import { assert } from "https://deno.land/std@v0.3.1/testing/asserts.ts";
import { defer } from "./deferred.ts";
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
  trailers?: Headers
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
};

export async function* serve(
  addr: string,
  opts?: ServeOptions
): AsyncIterableIterator<IncomingHttpRequest> {
  const cancel = (opts && opts.cancel) || defer().promise;
  const keepAliveTimeout = ((opts && opts.keepAliveTimeout) || 75) * 1000;
  assert(keepAliveTimeout >= 0, "keepAliveTimeout must be >= 0");
  const listener = listen("tcp", addr);
  let canceled = false;
  let onRequestDeferred = defer<IncomingHttpRequest>();
  (async function acceptRoutine() {
    while (!canceled) {
      const conn = await Promise.race([cancel, listener.accept()]);
      if (!isConn(conn)) {
        break;
      }
      const bufReader = new BufReader(conn);
      const bufWriter = new BufWriter(conn);
      (async () => {
        try {
          const req = await readRequest(bufReader, {
            timeout: keepAliveTimeout
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
    const req = await Promise.race([cancel, onRequestDeferred.promise]);
    onRequestDeferred = defer();
    if (!isIncomingHttpRequest(req)) {
      break;
    }
    yield req;
    (async function prepareForNext() {
      const { bufWriter, bufReader, body, conn, finalize } = req;
      try {
        await finalize();
        const nextReq = await readRequest(bufReader, {
          timeout: keepAliveTimeout
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
