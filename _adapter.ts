// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { createBodyParser } from "./body_parser.ts";
import { setupBodyInit } from "./serveio.ts";
import {
  BodyReader,
  IncomingRequest,
  ServeOptions,
  ServerResponse,
} from "./server.ts";
import { closableBodyReader, noopReader, streamReader } from "./_readers.ts";

export interface HttpApiAdapter {
  next(opts: ServeOptions): Promise<IncomingRequest | undefined>;
  respond(resp: ServerResponse): Promise<void>;
  close(): void;
}

export function nativeAdapter(conn: Deno.Conn): HttpApiAdapter {
  const http: Deno.HttpConn = Deno.serveHttp(conn);
  let ev: Deno.RequestEvent | null;
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

export function requestFromEvent(ev: Deno.RequestEvent): IncomingRequest {
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
    event: ev,
    ...bodyParser,
  };
}
