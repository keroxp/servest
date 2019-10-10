import { RoutedServerRequest } from "./router.ts";
import { BufReader, BufWriter } from "./vendor/https/deno.land/std/io/bufio.ts";
import { IncomingHttpResponse } from "./server.ts";
import { readResponse, setupBody } from "./serveio.ts";
import Reader = Deno.Reader;
import { createResponder } from "./responder.ts";

export type RequestRecorder = RoutedServerRequest & {
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
}): RequestRecorder {
  const conn: Deno.Conn = {
    localAddr: "",
    remoteAddr: "",
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
  let bodyReader: Reader | undefined;
  if (body) {
    bodyReader = setupBody(body, headers)[0];
  }
  async function response(): Promise<IncomingHttpResponse> {
    return readResponse(bufReader);
  }
  const responder = createResponder(bufWriter);
  return {
    url,
    method,
    headers,
    proto,
    finalize: async () => {},
    body: bodyReader,
    response,
    bufWriter,
    bufReader,
    conn,
    match,
    ...responder
  };
}
