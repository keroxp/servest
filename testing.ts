// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { RoutedServerRequest } from "./router.ts";
import { BufReader, BufWriter } from "./vendor/https/deno.land/std/io/bufio.ts";
import { IncomingHttpResponse } from "./server.ts";
import { readResponse, setupBody } from "./serveio.ts";
import Reader = Deno.Reader;
import { createResponder } from "./responder.ts";
import { bodyReader, BodyReader, chunkedBodyReader } from "./readers.ts";
import { parseCookie } from "./cookie.ts";

export type ResponseRecorder = RoutedServerRequest & {
  /** Obtain recorded response */
  response(): Promise<IncomingHttpResponse>;
};

/** Create dummy request & responder that records a response from HTTPHandler  */
export function createRecorder({
  url,
  method = "GET",
  headers = new Headers(),
  body,
  proto = "http",
  match
}: {
  url: string;
  method?: string;
  proto?: string;
  headers?: Headers;
  body?: string | Uint8Array | Reader;
  match?: RegExpMatchArray | null;
}): ResponseRecorder {
  const conn: Deno.Conn = {
    localAddr: { transport: "tcp", hostname: "0.0.0.0", port: 80 },
    remoteAddr: { transport: "tcp", hostname: "0.0.0.0", port: 80 },
    rid: 0,
    close(): void {},
    closeRead(): void {},
    closeWrite(): void {},
    async read(p: Uint8Array): Promise<number | Deno.EOF> {
      return 0;
    },
    async write(p: Uint8Array): Promise<number> {
      return 0;
    }
  };
  const buf = new Deno.Buffer();
  const bufReader = new BufReader(buf);
  const bufWriter = new BufWriter(buf);
  let br: BodyReader | undefined;
  if (body) {
    const [a, b] = setupBody(body, headers);
    if (b !== undefined) {
      br = bodyReader(a, b);
    } else {
      br = chunkedBodyReader(a);
    }
  }
  async function response(): Promise<IncomingHttpResponse> {
    return readResponse(bufReader);
  }
  const responder = createResponder(bufWriter);
  const cookies = parseCookie(headers.get("Cookie") || "");
  const { pathname: path, searchParams: query } = new URL(url, "http://dummy");
  return {
    url,
    path,
    query,
    method,
    headers,
    proto,
    finalize: async () => {},
    body: br,
    response,
    bufWriter,
    bufReader,
    conn,
    cookies,
    match,
    ...responder
  };
}
