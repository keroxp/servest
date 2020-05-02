// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import {
  BufReader,
  BufWriter,
} from "./vendor/https/deno.land/std/io/bufio.ts";
import {
  IncomingHttpResponse,
  ServerRequest,
  HttpBody,
} from "./server.ts";
import { readResponse, setupBody } from "./serveio.ts";
import { createResponder, ServerResponder } from "./responder.ts";
import { BodyReader, closableBodyReader } from "./readers.ts";
import { parseCookie } from "./cookie.ts";
import {
  bodyReader,
  chunkedBodyReader,
  emptyReader,
} from "./vendor/https/deno.land/std/http/io.ts";
import { createBodyParser, BodyParser } from "./body_parser.ts";
import { createDataHolder } from "./data_holder.ts";

export type ResponseRecorder = ServerRequest & {
  /** Obtain recorded response */
  response(): Promise<IncomingHttpResponse & BodyParser>;
};

/** Create dummy request & responder that records a response from HTTPHandler  */
export function createRecorder({
  url,
  method = "GET",
  headers = new Headers(),
  body,
  proto = "http",
}: {
  url: string;
  method?: string;
  proto?: string;
  headers?: Headers;
  body?: HttpBody;
}): ResponseRecorder {
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
  async function response(): Promise<IncomingHttpResponse & BodyParser> {
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
    ...responder,
    ...bodyParser,
    ...dataHolder,
  };
}
