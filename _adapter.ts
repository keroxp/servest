// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { createBodyParser } from "./body_parser.ts";
import { readRequest, setupBodyInit, writeResponse } from "./serveio.ts";
import {
  BodyReader,
  IncomingRequest,
  ServeOptions,
  ServerResponse,
} from "./server.ts";
import { BufReader, BufWriter } from "./vendor/https/deno.land/std/io/bufio.ts";
import { closableBodyReader, noopReader, streamReader } from "./_readers.ts";

export interface HttpApiAdapter {
  next(opts: ServeOptions): Promise<IncomingRequest | undefined>;
  respond(resp: ServerResponse): Promise<void>;
  close(): void;
}

export function classicAdapter({ conn, bufReader, bufWriter }: {
  conn: Deno.Conn;
  bufReader: BufReader;
  bufWriter: BufWriter;
}): HttpApiAdapter {
  return {
    async next(opts) {
      return readRequest(bufReader, opts);
    },
    async respond(resp) {
      await writeResponse(bufWriter, resp);
    },
    close() {
      conn.close();
    },
  };
}

export interface RequestEvent {
  readonly request: Request;
  respondWith(r: Response | Promise<Response>): void;
}

export interface HttpConn extends AsyncIterable<RequestEvent> {
  readonly rid: number;

  nextRequest(): Promise<RequestEvent | null>;
  close(): void;
}

export function nativeAdapter(conn: Deno.Conn): HttpApiAdapter {
  const http: HttpConn = Deno.serveHttp(conn);
  let ev: RequestEvent | null;
  let closed = false;
  return {
    async next() {
      ev = await http.nextRequest();
      if (!ev) {
        closed = true;
        return;
      }
      return requestFromEvent(ev);
    },
    async respond(resp) {
      if (!ev) throw new Error("Unexpected respond");
      const headers = resp.headers ?? new Headers();
      let body: BodyInit | undefined;
      if (resp.body) {
        const [_body, contentType] = setupBodyInit(resp.body);
        body = _body;
        if (!headers.has("content-type")) {
          headers.set("content-type", contentType);
        }
      }
      // TODO: trailer
      try {
        await ev.respondWith(
          new Response(body, {
            status: resp.status,
            headers,
          }),
        );
      } finally {
        ev = null;
      }
    },
    close() {
      if (!closed) {
        http.close();
      }
    },
  };
}

function requestFromEvent(ev: RequestEvent): IncomingRequest {
  const { pathname, search, searchParams } = new URL(
    ev.request.url,
    "http://dummy",
  );
  const { method, headers } = ev.request;
  const contentType = headers.get("content-type") ?? "";
  let body: BodyReader;
  if (ev.request.body) {
    body = closableBodyReader(streamReader(ev.request.body));
  } else {
    body = closableBodyReader(noopReader());
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
