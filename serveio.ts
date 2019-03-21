// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import {
  BufReader,
  BufState,
  BufWriter
} from "https://deno.land/std@v0.3.2/io/bufio.ts";
import { TextProtoReader } from "https://deno.land/std@v0.3.2/textproto/mod.ts";
import {
  BodyReader,
  ChunkedBodyReader,
  readUntilEof,
  TimeoutReader
} from "./readers.ts";
import { defer, promiseInterrupter } from "./promises.ts";
import { assert } from "https://deno.land/std@v0.3.2/testing/asserts.ts";
import {
  decode,
  encode
} from "https://deno.land/std@v0.3.2/strings/strings.ts";
import {
  ClientRequest,
  IncomingHttpRequest,
  IncomingHttpResponse,
  ServerRequest,
  ServerResponse
} from "./server.ts";
import Reader = Deno.Reader;
import Writer = Deno.Writer;
import Buffer = Deno.Buffer;

function bufReader(r: Reader): BufReader {
  if (r instanceof BufReader) {
    return r;
  } else {
    return new BufReader(r);
  }
}

/**
 * read http request from reader
 * status-line and headers are certainly read. body and trailers may not be read
 * read will be aborted when opts.cancel is called or any read wait to reader is over opts.readTimeout
 * */
export async function readRequest(
  r: Reader,
  opts?: {
    cancel: Promise<void>;
    keepAliveTimeout: number;
    readTimeout: number;
  }
): Promise<IncomingHttpRequest> {
  let keepAliveTimeout = 75000;
  let readTimeout = 75000;
  let cancel = defer().promise;
  if (opts) {
    if (Number.isInteger(opts.keepAliveTimeout)) {
      keepAliveTimeout = opts.keepAliveTimeout;
    }
    if (Number.isInteger(opts.readTimeout)) {
      readTimeout = opts.readTimeout;
    }
    if (opts.cancel) {
      cancel = opts.cancel;
    }
  }
  const reader = bufReader(r);
  const tpReader = new TextProtoReader(reader);
  // read status line
  let resLine: string;
  let headers: Headers;
  let state: BufState;
  [resLine, state] = await promiseInterrupter({
    timeout: keepAliveTimeout,
    cancel
  })(tpReader.readLine());
  if (state) {
    throw new Error(`read failed: ${state}`);
  }
  const [m, method, url, proto] = resLine.match(/^([^ ]+)? ([^ ]+?) ([^ ]+?)$/);
  // read header
  [headers, state] = await promiseInterrupter({
    timeout: readTimeout,
    cancel
  })(tpReader.readMIMEHeader());
  if (state) {
    throw new Error(`read failed: ${state}`);
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
        timeout: readTimeout,
        cancel
      });
    } else {
      const contentLength = parseInt(headers.get("content-length"));
      assert(
        contentLength >= 0,
        `content-length is missing or invalid: ${headers.get("content-length")}`
      );
      body = new TimeoutReader(new BodyReader(reader, contentLength), {
        timeout: readTimeout,
        cancel
      });
    }
  }
  return {
    method,
    url,
    proto,
    headers,
    body,
    get trailers() {
      return trailers;
    },
    finalize
  };
}

/** write http request. Host, Content-Length, Transfer-Encoding headers are set if needed */
export async function writeRequest(w: Writer, req: ClientRequest) {
  const writer = bufWriter(w);
  let { method, body, headers } = req;
  const url = new URL(req.url);
  if (!headers) {
    headers = new Headers();
  }
  // start line
  const lines = [`${method} ${url.pathname}${url.search || ""} HTTP/1.1`];
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
  for (const [key, value] of headers) {
    lines.push(`${key}: ${value}`);
  }
  lines.push("\r\n");
  const headerText = lines.join("\r\n");
  await writer.write(encode(headerText));
  const state = await writer.flush();
  if (state) {
    throw new Error(`failed to write headers: ${state}`);
  }
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
  const [line, lineErr] = await timeoutOrCancel(tp.readLine());
  if (lineErr) {
    throw lineErr;
  }
  const [proto, status, statusText] = line.split(" ", 3);
  const [headers, headersErr] = await timeoutOrCancel(tp.readMIMEHeader());
  if (headersErr) {
    throw headersErr;
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
export async function writeResponse(w: Writer, res: ServerResponse) {
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
export async function writeHeaders(w: Writer, headers: Headers) {
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
) {
  if (!body) return;
  const buf = new Uint8Array(1024);
  let writer = bufWriter(w);
  const reader = body instanceof Uint8Array ? new Buffer(body) : body;
  const hasContentLength = Number.isInteger(contentLength);
  while (true) {
    const { nread, eof } = await reader.read(buf);
    if (nread > 0) {
      const chunk = buf.slice(0, nread);
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
    if (eof) {
      if (!hasContentLength) {
        await writer.write(encode("0\r\n\r\n"));
        await writer.flush();
      }
      break;
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
) {
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
    const [line, ok, state] = await reader.readLine();
    if (state) {
      throw new Error(`${state}`);
    }
    const [_, field, value] = decode(line)
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
