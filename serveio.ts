// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { BufReader, BufWriter } from "./vendor/https/deno.land/std/io/bufio.ts";
import { TextProtoReader } from "./vendor/https/deno.land/std/textproto/mod.ts";
import {
  BodyReader,
  ChunkedBodyReader,
  readUntilEof,
  TimeoutReader
} from "./readers.ts";
import { defer, promiseInterrupter } from "./promises.ts";
import {
  assert,
  AssertionError
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import {
  ClientRequest,
  IncomingHttpRequest,
  IncomingHttpResponse,
  KeepAlive,
  ServeOptions,
  ServerResponse
} from "./server.ts";
import { encode } from "./vendor/https/deno.land/std/strings/encode.ts";
import { decode } from "./vendor/https/deno.land/std/strings/decode.ts";
import Reader = Deno.Reader;
import Writer = Deno.Writer;
import Buffer = Deno.Buffer;
import EOF = Deno.EOF;
import { dateToDateHeader } from "./util.ts";

function bufReader(r: Reader): BufReader {
  if (r instanceof BufReader) {
    return r;
  } else {
    return new BufReader(r);
  }
}

export const kDefaultKeepAliveTimeout = 75000; // ms

export function initServeOptions(opts: ServeOptions = {}): ServeOptions {
  let cancel = opts.cancel;
  let keepAliveTimeout = kDefaultKeepAliveTimeout;
  let readTimeout = kDefaultKeepAliveTimeout;
  if (opts.keepAliveTimeout !== void 0) {
    keepAliveTimeout = opts.keepAliveTimeout;
  }
  if (opts.readTimeout !== void 0) {
    readTimeout = opts.readTimeout;
  }
  assert(keepAliveTimeout >= 0, "keepAliveTimeout must be >= 0");
  assert(readTimeout >= 0, "readTimeout must be >= 0");
  return { cancel, keepAliveTimeout, readTimeout };
}

/**
 * read http request from reader
 * status-line and headers are certainly read. body and trailers may not be read
 * read will be aborted when opts.cancel is called or any read wait to reader is over opts.readTimeout
 * */
export async function readRequest(
  r: Reader,
  opts: ServeOptions = {}
): Promise<IncomingHttpRequest> {
  opts = initServeOptions(opts);
  const reader = bufReader(r);
  const tpReader = new TextProtoReader(reader);
  // read status line
  // use keepAliveTimeout for reading request line
  const resLine = await promiseInterrupter({
    timeout: opts.keepAliveTimeout,
    cancel: opts.cancel
  })(tpReader.readLine());
  if (resLine === EOF) {
    throw EOF;
  }
  let [_, method, url, proto] = resLine.match(/^([^ ]+)? ([^ ]+?) ([^ ]+?)$/);
  method = method.toUpperCase();
  url = url.toLowerCase();
  // read header
  const headers = await promiseInterrupter({
    timeout: opts.readTimeout,
    cancel: opts.cancel
  })(tpReader.readMIMEHeader());
  if (headers === EOF) {
    throw EOF;
  }
  let keepAlive;
  if (headers.has("keep-alive")) {
    keepAlive = parseKeepAlive(headers);
  }
  // body
  let body: Reader | undefined;
  let trailers: Headers;
  let finalizers: (() => Promise<void>)[] = [];
  const finalize = async () => {
    for (const f of finalizers) {
      await f();
    }
  };
  if (method === "POST" || method === "PUT") {
    finalizers.push(async () => {
      await readUntilEof(body);
    });
    if (headers.get("transfer-encoding") === "chunked") {
      if (headers.has("trailer")) {
        finalizers.push(async () => {
          trailers = await readTrailers(reader, headers);
        });
      }
      body = new TimeoutReader(new ChunkedBodyReader(reader), {
        timeout: opts.readTimeout,
        cancel: opts.cancel
      });
    } else {
      const contentLength = parseInt(headers.get("content-length"));
      assert(
        contentLength >= 0,
        `content-length is missing or invalid: ${headers.get("content-length")}`
      );
      body = new TimeoutReader(new BodyReader(reader, contentLength), {
        timeout: opts.readTimeout,
        cancel: opts.cancel
      });
    }
  }
  return {
    method,
    url,
    proto,
    headers,
    body,
    keepAlive,
    get trailers() {
      return trailers;
    },
    finalize
  };
}

/** write http request. Host, Content-Length, Transfer-Encoding headers are set if needed */
export async function writeRequest(
  w: Writer,
  req: ClientRequest
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
    encode(`${method} ${url.pathname}${url.search || ""} HTTP/1.1\r\n`)
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
}

/** read http response from reader */
export async function readResponse(
  r: Reader,
  {
    timeout = -1,
    cancel = defer().promise
  }: { timeout?: number; cancel?: Promise<void> } = {}
): Promise<IncomingHttpResponse> {
  const reader = bufReader(r);
  const tp = new TextProtoReader(reader);
  const timeoutOrCancel = promiseInterrupter({ timeout, cancel });
  // First line: HTTP/1,1 200 OK
  const line = await timeoutOrCancel(tp.readLine());
  if (line === EOF) {
    throw EOF;
  }
  const [proto, status, statusText] = line.split(" ", 3);
  const headers = await timeoutOrCancel(tp.readMIMEHeader());
  if (headers === EOF) {
    throw EOF;
  }
  const contentLength = headers.get("content-length");
  const isChunked = headers.get("transfer-encoding") === "chunked";
  let body: Reader;
  let finalizers = [
    async () => {
      await readUntilEof(body);
    }
  ];
  const finalize = async () => {
    for (const f of finalizers) {
      await f();
    }
  };
  let trailers: Headers;
  if (isChunked) {
    if (headers.has("trailer")) {
      finalizers.push(async () => {
        trailers = await readTrailers(reader, headers);
      });
    }
    body = new TimeoutReader(new ChunkedBodyReader(reader), {
      timeout,
      cancel
    });
  } else {
    body = new TimeoutReader(new BodyReader(reader, parseInt(contentLength)), {
      timeout,
      cancel
    });
  }
  return {
    proto,
    status: parseInt(status),
    statusText,
    headers,
    body,
    get trailers() {
      return trailers;
    },
    finalize
  };
}

export const kHttpStatusMessages = {
  100: "Continue",
  101: "Switching Protocols",
  102: "Processing",
  103: "Early Hints",
  200: "OK",
  201: "Created",
  202: "Accepted",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  500: "Internal Server Error"
};

export function setupBody(
  body: string | Uint8Array | Reader,
  headers: Headers
): [Reader, number | undefined] {
  let r: Reader;
  let len: number | undefined;
  if (body instanceof Uint8Array) {
    headers.set("content-length", `${body.byteLength}`);
    [r, len] = [new Buffer(body), body.byteLength];
  } else if (typeof body === "string") {
    const bin = encode(body);
    headers.set("content-length", `${bin.byteLength}`);
    [r, len] = [new Buffer(bin), bin.byteLength];
    if (!headers.has("content-type")) {
      headers.set("content-type", "text/plain; charset=UTF-8");
    }
  } else {
    if (!headers.has("content-length") && !headers.has("transfer-encoding")) {
      headers.set("transfer-encoding", "chunked");
    }
    const size = headers.get("content-length");
    if (size) {
      len = parseInt(size);
    }
    r = body;
  }
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/octet-stream");
  }
  return [r, len];
}
/** write http response to writer. Content-Length, Transfer-Encoding headers are set if needed */
export async function writeResponse(
  w: Writer,
  res: ServerResponse
): Promise<void> {
  const writer = BufWriter.create(w);
  if (res.headers === void 0) {
    res.headers = new Headers();
  }
  // status line
  const statusText = kHttpStatusMessages[res.status];
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
}

/** write headers to writer */
export async function writeHeaders(w: Writer, headers: Headers): Promise<void> {
  const lines: string[] = [];
  const writer = BufWriter.create(w);
  if (!headers.has("date")) {
    headers.set("date", dateToDateHeader());
  }
  if (headers)
    for (const [key, value] of headers) {
      lines.push(`${key}: ${value}`);
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
  contentLength?: number
): Promise<void> {
  let writer = BufWriter.create(w);
  const hasContentLength =
    typeof contentLength === "number" && Number.isInteger(contentLength);
  if (hasContentLength) {
    await Deno.copy(writer, body);
    await writer.flush();
  } else {
    while (true) {
      // TODO: add opts for buffer size
      const buf = new Uint8Array(2048);
      const result = await body.read(buf);
      if (result === EOF) {
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

const kProhibitedTrailerHeaders = [
  "transfer-encoding",
  "content-length",
  "trailer"
];

/** write trailer headers to writer. it mostly should be called after writeResponse */
export async function writeTrailers(
  w: Writer,
  headers: Headers,
  trailers: Headers
): Promise<void> {
  const trailer = headers.get("trailer");
  if (trailer === null) {
    throw new AssertionError(
      'response headers must have "trailer" header field'
    );
  }
  const transferEncoding = headers.get("transfer-encoding");
  if (transferEncoding === null || !transferEncoding.match(/^chunked/)) {
    throw new AssertionError(
      `trailer headers is only allowed for "transfer-encoding: chunked": got "${transferEncoding}"`
    );
  }
  const writer = BufWriter.create(w);
  const trailerHeaderFields = trailer
    .split(",")
    .map(s => s.trim().toLowerCase());
  for (const f of trailerHeaderFields) {
    assert(
      !kProhibitedTrailerHeaders.includes(f),
      `"${f}" is prohibited for trailer header`
    );
  }
  for (const [key, value] of trailers) {
    assert(
      trailerHeaderFields.includes(key),
      `Not trailed header field: ${key}`
    );
    await writer.write(encode(`${key}: ${value}\r\n`));
  }
  await writer.flush();
}

/** read trailer headers from reader. it should mostly be called after readRequest */
export async function readTrailers(
  r: Reader,
  headers: Headers
): Promise<Headers> {
  const h = new Headers();
  const reader = bufReader(r);
  const trailer = headers.get("trailer");
  if (trailer === null) {
    throw new AssertionError("trailer header must be set");
  }
  const trailerHeaderFields = trailer
    .split(",")
    .map(s => s.trim().toLowerCase());
  for (const field of trailerHeaderFields) {
    assert(
      kProhibitedTrailerHeaders.indexOf(field) < 0,
      `"${field}" is prohibited for trailer field`
    );
  }
  for (let i = 0; i < trailerHeaderFields.length; i++) {
    const readLine = await reader.readLine();
    if (readLine === EOF) {
      throw EOF;
    }
    const [_, field, value] = decode(readLine.line)
      .trim()
      .match(/^([^ :]+?):(.+?)$/);
    assert(
      trailerHeaderFields.includes(field),
      `unexpected trailer field: ${field}`
    );
    h.set(field.trim(), value.trim());
  }
  return h;
}

export function parseKeepAlive(h: Headers): KeepAlive {
  let timeout;
  let max;
  const keepAlive = h.get("keep-alive");
  if (keepAlive === null) {
    throw new AssertionError("keep-alive must be set");
  }
  const kv = keepAlive.split(",").map(s => s.trim().split("="));
  for (const [key, value] of kv) {
    if (key === "timeout") {
      timeout = parseInt(value);
      assert(
        Number.isInteger(timeout),
        `"timeout" must be integer: ${timeout}`
      );
    } else if (key === "max") {
      max = parseInt(value);
      assert(Number.isInteger(max), `"max" max be integer: ${max}`);
    }
  }
  return { timeout, max };
}
