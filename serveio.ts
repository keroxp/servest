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
import { assert } from "./vendor/https/deno.land/std/testing/asserts.ts";
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

function bufReader(r: Reader): BufReader {
  if (r instanceof BufReader) {
    return r;
  } else {
    return new BufReader(r);
  }
}

const kDefaultKeepAliveTimeout = 75000; // ms

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
  const [m, method, url, proto] = resLine.match(/^([^ ]+)? ([^ ]+?) ([^ ]+?)$/);
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
  let body: Reader;
  let trailers: Headers;
  let finalizers = [];
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
  const writer = bufWriter(w);
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
  if (!headers.has("Host")) {
    headers.set("Host", url.host);
  }
  let contentLength: number;
  if (body) {
    if (headers.has("Content-Length")) {
      const cl = headers.get("Content-Length");
      contentLength = parseInt(cl);
      assert(
        Number.isInteger(contentLength),
        `content-length is not number: ${cl}`
      );
    } else if (body instanceof Uint8Array) {
      contentLength = body.byteLength;
      headers.set("Content-Length", `${body.byteLength}`);
    } else {
      headers.set("Transfer-Encoding", "chunked");
    }
  }
  await writeHeaders(writer, headers);
  await writer.flush();
  if (body) {
    await writeBody(writer, body, contentLength);
  }
}

/** read http response from reader */
export async function readResponse(
  r: Reader,
  opts?: { timeout?: number; cancel?: Promise<void> }
): Promise<IncomingHttpResponse> {
  let timeout = -1;
  if (opts && Number.isInteger(opts.timeout)) {
    timeout = opts.timeout;
  }
  let cancel = defer().promise;
  if (opts && opts.cancel) {
    cancel = opts.cancel;
  }
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

function bufWriter(w: Writer) {
  if (w instanceof BufWriter) {
    return w;
  } else {
    return new BufWriter(w);
  }
}

const kHttpStatusCodes = {
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

/** write http response to writer. Content-Length, Transfer-Encoding headers are set if needed */
export async function writeResponse(
  w: Writer,
  res: ServerResponse
): Promise<void> {
  const writer = bufWriter(w);
  if (res.headers === void 0) {
    res.headers = new Headers();
  }
  // status line
  const statusText = kHttpStatusCodes[res.status];
  assert(!!statusText, `unsupported status code: ${statusText}`);
  await writer.write(encode(`HTTP/1.1 ${res.status} ${statusText}\r\n`));
  if (res.body && !res.headers.has("content-length")) {
    if (res.body instanceof Uint8Array) {
      res.headers.set("content-length", `${res.body.byteLength}`);
    } else if (!res.headers.has("transfer-encoding")) {
      res.headers.set("transfer-encoding", "chunked");
    }
  }
  await writeHeaders(writer, res.headers);
  if (res.body) {
    let contentLength;
    if (res.headers.has("content-length")) {
      contentLength = parseInt(res.headers.get("content-length"));
    }
    await writeBody(writer, res.body, contentLength);
  }
}

/** write headers to writer */
export async function writeHeaders(w: Writer, headers: Headers): Promise<void> {
  const lines = [];
  const writer = bufWriter(w);
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
  body: Uint8Array | Reader,
  contentLength?: number
): Promise<void> {
  if (!body) return;
  const buf = new Uint8Array(1024);
  let writer = bufWriter(w);
  const reader = body instanceof Uint8Array ? new Buffer(body) : body;
  const hasContentLength = Number.isInteger(contentLength);
  while (true) {
    const result = await reader.read(buf);
    if (result === EOF) {
      if (!hasContentLength) {
        await writer.write(encode("0\r\n\r\n"));
        await writer.flush();
      }
      break;
    } else if (result > 0) {
      const chunk = buf.slice(0, result);
      if (hasContentLength) {
        await writer.write(chunk);
      } else {
        const size = chunk.byteLength.toString(16);
        await writer.write(encode(`${size}\r\n`));
        await writer.write(chunk);
        await writer.write(encode("\r\n"));
      }
      await writer.flush();
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
  assert(
    headers.has("trailer"),
    'response headers must have "trailer" header field'
  );
  const transferEncoding = headers.get("transfer-encoding");
  assert(
    transferEncoding === "chunked",
    `trailer headers is only allowed for "transfer-encoding: chunked": got "${transferEncoding}"`
  );
  const writer = bufWriter(w);
  const trailerHeaderFields = headers
    .get("trailer")
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
  const trailerHeaderFields = headers
    .get("trailer")
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
  const kv = h
    .get("keep-alive")
    .split(",")
    .map(s => s.trim().split("="));
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
