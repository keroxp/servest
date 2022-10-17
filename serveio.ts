// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { BufReader, BufWriter } from "./vendor/https/deno.land/std/io/bufio.ts";
import { Buffer } from "./vendor/https/deno.land/std/io/buffer.ts";
import { TextProtoReader } from "./vendor/https/deno.land/std/textproto/mod.ts";
import { closableBodyReader, streamReader, timeoutReader } from "./_readers.ts";
import { encode, promiseInterrupter } from "./_util.ts";
import {
  assert,
  AssertionError,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import {
  BodyReader,
  ClientRequest,
  HttpBody,
  IncomingResponse,
  ServerResponse,
} from "./server.ts";
import Reader = Deno.Reader;
import Writer = Deno.Writer;
import { toIMF } from "./vendor/https/deno.land/std/datetime/mod.ts";
import {
  bodyReader,
  chunkedBodyReader,
  writeTrailers,
} from "./vendor/https/deno.land/std/http/_io.ts";
import { createBodyParser } from "./body_parser.ts";
import { UnexpectedEofError } from "./error.ts";
import { STATUS_TEXT } from "./vendor/https/deno.land/std/http/http_status.ts";

export const kDefaultKeepAliveTimeout = 75000; // ms

/** write http request. Host, Content-Length, Transfer-Encoding headers are set if needed */
export async function writeRequest(
  w: Writer,
  req: ClientRequest,
): Promise<void> {
  const writer = BufWriter.create(w);
  let { method, body, headers } = req;
  method = method.toUpperCase();
  const url = new URL(req.url);
  if (!headers) {
    headers = new Headers();
  }
  // start line
  await writer.write(
    encode(`${method} ${url.pathname}${url.search || ""} HTTP/1.1\r\n`),
  );
  // header
  if (!headers.has("host")) {
    headers.set("host", url.host);
  }
  let contentLength: number | undefined;
  let bodyReader: Reader | undefined;
  if (body) {
    [bodyReader, contentLength] = setupBody(body, headers);
  }
  await writeHeaders(writer, headers);
  await writer.flush();
  if (bodyReader) {
    await writeBody(writer, bodyReader, contentLength);
  }
  if (req.trailers) {
    const trailers = await req.trailers();
    await writeTrailers(writer, headers, trailers);
  }
}

/** read http response from reader */
export async function readResponse(
  r: Reader,
  { timeout, cancel }: { timeout?: number; cancel?: Promise<void> } = {},
): Promise<IncomingResponse> {
  const reader = BufReader.create(r);
  const tp = new TextProtoReader(reader);
  const timeoutOrCancel = promiseInterrupter({ timeout, cancel });
  // First line: HTTP/1,1 200 OK
  const line = await timeoutOrCancel(tp.readLine());
  if (line === null) {
    throw new UnexpectedEofError();
  }
  const [proto, status, statusText] = line.split(" ", 3);
  const headers = await timeoutOrCancel(tp.readMIMEHeader());
  if (headers === null) {
    throw new UnexpectedEofError();
  }
  const contentLength = headers.get("content-length");
  const isChunked = headers.get("transfer-encoding")?.match(/^chunked/);
  let body: BodyReader;
  if (isChunked) {
    const tr = timeoutReader(chunkedBodyReader(headers, reader), {
      timeout,
      cancel,
    });
    body = closableBodyReader(tr);
  } else if (contentLength != null) {
    const tr = timeoutReader(bodyReader(parseInt(contentLength), reader), {
      timeout,
      cancel,
    });
    body = closableBodyReader(tr);
  } else {
    throw new Error("unkown conetnt-lengh or chunked");
  }
  const bodyParser = createBodyParser({
    reader: body,
    contentType: headers.get("content-type") ?? "",
  });
  return {
    proto,
    status: parseInt(status),
    statusText,
    headers,
    body,
    ...bodyParser,
  };
}

function bodyToReader(
  body: HttpBody,
  headers: Headers,
): [Reader, number | undefined] {
  if (typeof body === "string") {
    const bin = encode(body);
    return [new Buffer(bin), bin.byteLength];
  } else if (body instanceof Uint8Array) {
    return [new Buffer(body), body.byteLength];
  } else if (body instanceof ReadableStream) {
    const cl = headers.get("content-length");
    return [streamReader(body), cl ? parseInt(cl) : undefined];
  } else {
    const cl = headers.get("content-length");
    return [body, cl ? parseInt(cl) : undefined];
  }
}

export function setupBody(
  body: HttpBody,
  headers: Headers,
): [Reader, number | undefined] {
  let [r, len] = bodyToReader(body, headers);
  const transferEncoding = headers.get("transfer-encoding");
  let chunked = transferEncoding?.match(/^chunked/) != null;
  if (!chunked && typeof len === "number") {
    headers.set("content-length", `${len}`);
  }
  if (typeof body === "string") {
    if (!headers.has("content-type")) {
      headers.set("content-type", "text/plain; charset=UTF-8");
    }
  } else if (body instanceof Uint8Array) {
    // noop
  } else {
    if (!headers.has("content-length") && !headers.has("transfer-encoding")) {
      headers.set("transfer-encoding", "chunked");
      chunked = true;
    }
  }
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/octet-stream");
  }
  return [r, chunked ? undefined : len];
}

export function setupBodyInit(body: HttpBody): [BodyInit, string] {
  if (typeof body === "string") {
    return [body, "text/plain; charset=UTF-8"];
  } else if (body instanceof Uint8Array) {
    return [body, "application/octet-stream"];
  } else if (body instanceof ReadableStream) {
    return [body, "application/octet-stream"];
  } else {
    const buf = new Uint8Array(2048);
    return [
      new ReadableStream<Uint8Array>({
        async pull(ctrl) {
          const len = await body.read(buf);
          if (len != null) {
            ctrl.enqueue(buf.subarray(0, len));
          } else {
            ctrl.close();
          }
        },
      }),
      "application/octet-stream",
    ];
  }
}

/** write http response to writer. Content-Length, Transfer-Encoding headers are set if needed */
export async function writeResponse(
  w: Writer,
  res: ServerResponse,
): Promise<void> {
  const writer = BufWriter.create(w);
  if (!res.headers) {
    res.headers = new Headers();
  }
  // status line
  const statusText = STATUS_TEXT.get(res.status);
  assert(!!statusText, `unsupported status code: ${statusText}`);
  await writer.write(encode(`HTTP/1.1 ${res.status} ${statusText}\r\n`));
  let bodyReader: Reader | undefined;
  let contentLength: number | undefined;
  if (res.body) {
    [bodyReader, contentLength] = setupBody(res.body, res.headers);
  } else if (!res.headers.has("content-length")) {
    res.headers.set("content-length", "0");
  }
  await writeHeaders(writer, res.headers);
  if (bodyReader) {
    await writeBody(writer, bodyReader, contentLength);
  }
  if (res.trailers) {
    const trailer = await res.trailers();
    await writeTrailers(writer, res.headers, trailer);
  }
}

/** write headers to writer */
export async function writeHeaders(w: Writer, headers: Headers): Promise<
  void
> {
  const lines: string[] = [];
  const writer = BufWriter.create(w);
  if (!headers.has("date")) {
    headers.set("date", toIMF(new Date()));
  }
  if (headers) {
    for (const [key, value] of headers) {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push("\r\n");
  const headerText = lines.join("\r\n");
  await writer.write(encode(headerText));
  await writer.flush();
}

/** write http body to writer. Reader without contentLength will be written by chunked encoding */
export async function writeBody(
  w: Writer,
  body: Reader,
  contentLength?: number,
): Promise<void> {
  let writer = BufWriter.create(w);
  const hasContentLength = typeof contentLength === "number" &&
    Number.isInteger(contentLength);
  if (hasContentLength) {
    await Deno.copy(body, writer);
    await writer.flush();
  } else {
    while (true) {
      // TODO: add opts for buffer size
      const buf = new Uint8Array(2048);
      const result = await body.read(buf);
      if (result === null) {
        await writer.write(encode("0\r\n\r\n"));
        await writer.flush();
        break;
      } else if (result > 0) {
        const chunk = buf.slice(0, result);
        const size = result.toString(16);
        await writer.write(encode(`${size}\r\n`));
        await writer.write(chunk);
        await writer.write(encode("\r\n"));
        await writer.flush();
      }
    }
  }
}
