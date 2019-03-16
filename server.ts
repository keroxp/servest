// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import listen = Deno.listen;
import Conn = Deno.Conn;
import Reader = Deno.Reader;
import Writer = Deno.Writer;
import Buffer = Deno.Buffer;
import {TextProtoReader} from "https://deno.land/std@v0.3.1/textproto/mod.ts";
import {BufReader, BufState, BufWriter} from "https://deno.land/std@v0.3.1/io/bufio.ts";
import {BodyReader, ChunkedBodyReader, readUntilEof, TimeoutReader} from "./readers.ts";
import {assert} from "https://deno.land/std@v0.3.1/testing/asserts.ts";
import {encode} from "https://deno.land/std@v0.3.1/strings/strings.ts";
import {defer, Deferred} from "./deferred.ts";
import {wait} from "./util.ts";


export interface ServerRequest {
  /** request path with queries. always begin with / */
  url: string;
  /** HTTP method */
  method: string;
  /** requested protocol. like HTTP/1.1 */
  proto: string;
  /** HTTP Headers */
  headers: Headers;
  /** body stream. body with "transfer-encoding: chunked" will automatically be combined into original data */
  body?: Reader;
  bufReader: BufReader;
  bufWriter: BufWriter;
  conn: Conn;
}

export interface ServerResponse {
  status: number;
  headers?: Headers;
  body?: Uint8Array | Reader;
}

function isConn(x): x is Conn {
  return typeof x === "object" && x.hasOwnProperty("rid");
}

function isServerRequest(x): x is ServerRequest {
  return typeof x === "object" && x.hasOwnProperty("url");
}

/** serve options */
export type ServeOptions = {
  /** canceller promise for async iteration. use defer() */
  cancel?: Promise<any>;
  /** read timeout for keep-alive connection in sec. default=75 */
  keepAliveTimeout?: number;
};

export async function* serve(
  addr: string,
  opts?: ServeOptions
): AsyncIterableIterator<ServerRequest> {
  const cancel = opts && opts.cancel || defer().promise;
  const keepAliveTimeout = ((opts && opts.keepAliveTimeout) || 75) * 1000;
  assert(keepAliveTimeout >= 0, "keepAliveTimeout must be >= 0");
  const listener = listen("tcp", addr);
  let canceled = false;
  let onRequestDeferred: Deferred<ServerRequest> = defer();
  (async function acceptRoutine() {
    while (!canceled) {
      const conn = await Promise.race([cancel, listener.accept()]);
      if (!isConn(conn)) {
        break;
      }
      const bufReader = new BufReader(conn);
      const bufWriter = new BufWriter(conn);
      (async () => {
        try {
          const req = await readRequest(bufReader, {timeout: keepAliveTimeout});
          onRequestDeferred.resolve(
            Object.assign(req, {
              bufWriter,
              bufReader,
              conn
            })
          );
        } catch (unused) {
          conn.close();
        }
      })();
    }
  })();
  while (true) {
    const req = await Promise.race([cancel, onRequestDeferred.promise]);
    onRequestDeferred = defer();
    if (!isServerRequest(req)) {
      break;
    }
    yield req;
    (async function prepareForNext() {
      const {bufWriter, bufReader, body, conn} = req;
      try {
        if (body) {
          await readUntilEof(body);
        }
        const nextReq = await readRequest(bufReader, {timeout: keepAliveTimeout});
        onRequestDeferred.resolve(
          Object.assign(nextReq, {bufWriter, bufReader, conn})
        );
      } catch (unused) {
        conn.close();
      }
    })();
  }
  canceled = true;
  listener.close();
}

function bufReader(r: Reader): BufReader {
  if (r instanceof BufReader) {
    return r;
  } else {
    return new BufReader(r);
  }
}

export async function readRequest(
  r: Reader,
  opts: {
    timeout: number
  }
): Promise<{
  /** request path with queries. always begin with / */
  url: string;
  /** HTTP method */
  method: string;
  /** requested protocol. like HTTP/1.1 */
  proto: string;
  /** HTTP Headers */
  headers: Headers;
  body?: Reader;
}> {
  const reader = bufReader(r);
  const tpReader = new TextProtoReader(reader);
  // read status line
  let resLine: string;
  let headers: Headers;
  let state: BufState;
  [resLine, state] = await Promise.race([
    wait<[string, BufState]>(opts.timeout, ["", new Error("keep-alive read timeout")]),
    tpReader.readLine()
  ]);
  if (state) {
    throw new Error(`read failed: ${state}`);
  }
  const [m, method, url, proto] = resLine.match(/^([^ ]+)? ([^ ]+?) ([^ ]+?)$/);
  // read header
  [headers, state] = await Promise.race<[Headers, BufState]>([
    wait<[Headers, BufState]>(opts.timeout, [null, new Error("keep-alive read timeout")]),
    tpReader.readMIMEHeader()
  ]);
  if (state) {
    throw new Error(`read failed: ${state}`);
  }
  // read body
  let body: Reader;
  if (method === "POST" || method === "PUT") {
    if (headers.get("transfer-encoding") === "chunked") {
      body = new TimeoutReader(new ChunkedBodyReader(reader), opts.timeout);
    } else {
      const contentLength = parseInt(headers.get("content-length"));
      assert(
        contentLength >= 0,
        `content-length is missing or invalid: ${headers.get("content-length")}`
      );
      body = new TimeoutReader(new BodyReader(reader, contentLength), opts.timeout);
    }
  }
  return {
    method,
    url,
    proto,
    headers,
    body
  };
}

export async function writeRequest(w: Writer, req: {
  url: string,
  method: string,
  headers?: Headers,
  body?: Uint8Array | Reader
}) {
  const writer = w instanceof BufWriter ? w : new BufWriter(w);
  let {method, body, headers} = req;
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
      contentLength = parseInt(headers.get("Content-Length"))
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
    if (state instanceof Error) {
      throw state;
    } else {
      throw new Error(state);
    }
  }
  if (body) {
    await writeBody(writer, body, contentLength)
  }
}

export async function readResponse(
  r: Reader,
  opts: {
    timeout: number
  }
): Promise<ServerResponse> {
  const reader = bufReader(r);
  const tp = new TextProtoReader(reader);
  // First line: HTTP/1,1 200 OK
  const [line, lineErr] = await Promise.race([
    wait<[string, BufState]>(opts.timeout, [null, new Error("read timeout")]),
    tp.readLine()
  ]);
  if (lineErr) {
    throw lineErr;
  }
  const [proto, status, statusText] = line.split(" ", 3);
  const [headers, headersErr] = await Promise.race([
    wait<[Headers, BufState]>(opts.timeout, [null, new Error("read timeout")]),
    tp.readMIMEHeader(),
  ]);
  if (headersErr) {
    throw headersErr;
  }
  const contentLength = headers.get("content-length");
  const body =
    headers.get("transfer-encoding") === "chunked"
      ? new ChunkedBodyReader(reader)
      : new BodyReader(reader, parseInt(contentLength));
  return {status: parseInt(status), headers, body};
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

export async function writeResponse(w: Writer, res: ServerResponse) {
  const writer = bufWriter(w);
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

async function writeBody(
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
    const {nread, eof} = await reader.read(buf);
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
