import { createBodyParser } from "./body_parser.ts";
import { readRequest, writeResponse } from "./serveio.ts";
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
}

export function classicAdapter({ bufReader, bufWriter }: {
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
  };
}

interface RequestEvent {
  readonly request: Request;
  respondWith(r: Response | Promise<Response>): void;
}

interface HttpConn extends AsyncIterable<RequestEvent> {
  readonly rid: number;

  nextRequest(): Promise<RequestEvent | null>;
  close(): void;
}

export function nativeAdapter(conn: Deno.Conn): HttpApiAdapter {
  // @ts-ignore
  const http: HttpConn = Deno.startHttp(conn);
  let ev: RequestEvent | null;
  return {
    async next() {
      ev = await http.nextRequest();
      if (!ev) return;
      return requestFromEvent(ev);
    },
    async respond(resp) {
      if (!ev) throw new Error("Unexpected respond");
      const body = createBodyStream(resp);
      await ev.respondWith(
        new Response(body, {
          status: resp.status,
          headers: resp.headers,
        }),
      );
    },
  };
}

function requestFromEvent(ev: RequestEvent): IncomingRequest {
  const { pathname, search, searchParams } = new URL(ev.request.url);
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

const encoder = new TextEncoder();
function noopStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(ctrl) {
      ctrl.close();
    },
  });
}
function createBodyStream(resp: ServerResponse): ReadableStream<Uint8Array> {
  const { body, trailers } = resp;
  if (!body) {
    return noopStream();
  }
  // TODO: trailer
  if (body instanceof ReadableStream) {
    return body;
  } else if (body instanceof Uint8Array) {
    return new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(body);
        ctrl.close();
      },
    });
  } else if (typeof body === "string") {
    return new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(encoder.encode(body));
        ctrl.close();
      },
    });
  } else {
    const buf = new Uint8Array(2048);
    return new ReadableStream<Uint8Array>({
      async pull(ctrl) {
        const len = await body.read(buf);
        if (len != null) {
          ctrl.enqueue(buf.subarray(0, len));
        } else {
          ctrl.close();
        }
      },
    });
  }
}
