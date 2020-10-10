// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { BufReader, BufWriter } from "./vendor/https/deno.land/std/io/bufio.ts";
import {
  BodyReader,
  HttpBody,
  IncomingResponse,
  ServerRequest,
} from "./server.ts";
import { readResponse, setupBody } from "./serveio.ts";
import { createResponder } from "./responder.ts";
import { closableBodyReader } from "./_readers.ts";
import { parseCookie } from "./cookie.ts";
import {
  bodyReader,
  chunkedBodyReader,
  emptyReader,
} from "./vendor/https/deno.land/std/http/_io.ts";
import { BodyParser, createBodyParser } from "./body_parser.ts";
import { createDataHolder } from "./data_holder.ts";
import { assert } from "./vendor/https/deno.land/std/testing/asserts.ts";

export interface ResponseRecorder extends ServerRequest {
  /** Obtain recorded response */
  response(): Promise<IncomingResponse & BodyParser>;
}

/** Create dummy request & responder that records a response from HTTPHandler  */
export function createRecorder(opts?: {
  url?: string;
  method?: string;
  proto?: string;
  headers?: Headers;
  body?: HttpBody;
}): ResponseRecorder {
  const url = opts?.url ?? "/";
  const method = opts?.method ?? "GET";
  const headers = opts?.headers ?? new Headers();
  const body = opts?.body;
  const proto = opts?.proto ?? "http";
  const conn: Deno.Conn = {
    localAddr: { transport: "tcp", hostname: "0.0.0.0", port: 80 },
    remoteAddr: { transport: "tcp", hostname: "0.0.0.0", port: 80 },
    rid: 0,
    close(): void {},
    closeWrite(): void {},
    async read(p: Uint8Array): Promise<number | null> {
      return 0;
    },
    async write(p: Uint8Array): Promise<number> {
      return 0;
    },
  };
  const buf = new Deno.Buffer();
  const bufReader = new BufReader(buf);
  const bufWriter = new BufWriter(buf);
  let br: BodyReader;
  if (body) {
    const [reader, cl] = setupBody(body, headers);
    if (cl !== undefined) {
      br = closableBodyReader(bodyReader(cl, new BufReader(reader)));
    } else {
      br = closableBodyReader(
        chunkedBodyReader(headers, new BufReader(reader)),
      );
    }
  } else {
    br = closableBodyReader(emptyReader());
  }
  async function response(): Promise<IncomingResponse & BodyParser> {
    const resp = await readResponse(bufReader);
    const bodyParser = createBodyParser({
      reader: resp.body,
      contentType: resp.headers.get("content-type") ?? "",
    });
    return { ...resp, ...bodyParser };
  }
  const responder = createResponder(bufWriter);
  const bodyParser = createBodyParser({
    reader: br,
    contentType: headers.get("content-type") ?? "",
  });
  const cookies = parseCookie(headers.get("Cookie") || "");
  const { pathname: path, searchParams: query } = new URL(url, "http://dummy");
  const dataHolder = createDataHolder();
  const match = url.match(/^\//);
  assert(match != null);
  return {
    url,
    path,
    query,
    method,
    headers,
    proto,
    body: br,
    response,
    bufWriter,
    bufReader,
    conn,
    cookies,
    match,
    ...responder,
    ...bodyParser,
    ...dataHolder,
  };
}
