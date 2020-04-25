// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { BufReader } from "./vendor/https/deno.land/std/io/bufio.ts";
import {
  TextProtoReader,
} from "./vendor/https/deno.land/std/textproto/mod.ts";
import { promiseInterrupter } from "./promises.ts";
import Reader = Deno.Reader;
import EOF = Deno.EOF;
import {
  parserMultipartRequest,
  parseUrlEncodedForm,
} from "./body_parser.ts";
import { MultipartFormData } from "./vendor/https/deno.land/std/mime/multipart.ts";

const nullBuffer = new Uint8Array(1024);

export type BodyReader = Deno.Reader & BodyParser;

export async function readUntilEof(reader: Reader): Promise<number> {
  let total = 0;
  while (true) {
    const result = await reader.read(nullBuffer);
    if (result === EOF) {
      break;
    }
    total += result;
  }
  return total;
}

export interface BodyParser {
  text(): Promise<string>;
  json(): Promise<any>;
  arrayBuffer(): Promise<Uint8Array>;
  formData(headers: Headers, maxMemory?: number): Promise<MultipartFormData>;
}

interface BodyHolder {
  readonly reader: Reader;
  total(): number;
}

function bodyParser(holder: BodyHolder): BodyParser {
  let bodyBuf: Deno.Buffer | undefined;
  let formBody: MultipartFormData | undefined;
  let textBody: string | undefined;
  let jsonBody: any | undefined;
  async function formDataInternal(
    headers: Headers,
    body: Reader,
    maxMemory?: number,
  ): Promise<MultipartFormData> {
    const contentType = headers.get("content-type") || "";
    if (contentType.match(/^multipart\/form-data/)) {
      return parserMultipartRequest({ headers, body }, maxMemory);
    } else if (contentType.match(/^application\/x-www-form-urlencoded/)) {
      return parseUrlEncodedForm({
        headers,
        body,
      });
    } else {
      throw new Error(
        "request is not multipart/form-data nor application/x-www-form-urlencoded",
      );
    }
  }
  async function formData(
    headers: Headers,
    maxMemory?: number,
  ): Promise<MultipartFormData> {
    if (formBody) {
      return formBody;
    } else if (bodyBuf) {
      return (formBody = await formDataInternal(headers, bodyBuf, maxMemory));
    }
    if (holder.total() > 0) {
      throw new Error("body might have been be read before");
    }
    return (formBody = await formDataInternal(
      headers,
      holder.reader,
      maxMemory,
    ));
  }

  async function json<T>(): Promise<T> {
    if (jsonBody) {
      return jsonBody as T;
    } else if (bodyBuf) {
      return (jsonBody = JSON.parse(bodyBuf.toString()));
    }
    if (holder.total() > 0) {
      throw new Error("body might have been read before");
    }
    bodyBuf = new Deno.Buffer();
    await Deno.copy(bodyBuf, holder.reader);
    return JSON.parse(bodyBuf.toString());
  }

  async function text(): Promise<string> {
    if (textBody) {
      return textBody;
    } else if (bodyBuf) {
      return (textBody = bodyBuf.toString());
    }
    if (holder.total() > 0) {
      throw new Error("body might have been read before");
    }
    bodyBuf = new Deno.Buffer();
    await Deno.copy(bodyBuf, holder.reader);
    return (textBody = bodyBuf.toString());
  }

  async function arrayBuffer(): Promise<Uint8Array> {
    if (bodyBuf) {
      return bodyBuf.bytes();
    }
    if (holder.total() > 0) {
      throw new Error("body might have been read before");
    }
    bodyBuf = new Deno.Buffer();
    await Deno.copy(bodyBuf, holder.reader);
    return bodyBuf.bytes();
  }
  return { json, text, formData, arrayBuffer };
}

const kDefaultReadTimeout = 10000; // 10sec
export function bodyReader(
  r: Reader,
  contentLength: number,
  opts?: {
    timeout?: number;
    cancel?: Promise<void>;
  },
): BodyReader {
  let total: number = 0;
  async function read(p: Uint8Array): Promise<number | EOF> {
    const remaining = contentLength - total;
    let buf = p;
    if (p.byteLength > remaining) {
      buf = new Uint8Array(remaining);
    }
    let result = await r.read(buf);
    if (buf !== p) {
      p.set(buf);
    }
    let eof = result === EOF || total === contentLength;
    if (result !== EOF) {
      total += result;
    }
    return eof ? EOF : result;
  }
  const timeout = opts?.timeout ?? kDefaultReadTimeout;
  const cancel = opts?.cancel;
  const reader: Deno.Reader = timeoutReader({ read }, { timeout, cancel });
  const holder: BodyHolder = {
    reader,
    total() {
      return total;
    },
  };
  let transformer = bodyParser(holder);

  return { ...transformer, ...reader };
}

export function chunkedBodyReader(
  r: Reader,
  opts?: {
    timeout?: number;
    cancel?: Promise<void>;
  },
): BodyReader {
  let bufReader = BufReader.create(r);
  let tpReader = new TextProtoReader(bufReader);

  const chunks: Uint8Array[] = [];
  const crlfBuf = new Uint8Array(2);
  let finished: boolean = false;
  let total = 0;
  async function read(p: Uint8Array): Promise<number | EOF> {
    if (finished) {
      return EOF;
    }
    const line = await tpReader.readLine();
    if (line === EOF) {
      return EOF;
    }
    const len = parseInt(line, 16);
    if (len === 0) {
      finished = true;
      await bufReader.readFull(crlfBuf);
      return EOF;
    } else {
      const buf = new Uint8Array(len + 2);
      const res = await bufReader.readFull(buf);
      total += len;
      if (res === EOF) {
        return EOF;
      }
      chunks.push(buf.slice(0, len));
    }
    const buf = chunks[0];
    if (buf.byteLength <= p.byteLength) {
      p.set(buf);
      chunks.shift();
      return buf.byteLength;
    } else {
      p.set(buf.slice(0, p.byteLength));
      chunks[0] = buf.slice(p.byteLength, buf.byteLength);
      return p.byteLength;
    }
  }
  const timeout = opts?.timeout ?? kDefaultReadTimeout;
  const cancel = opts?.cancel;
  const reader: Deno.Reader = timeoutReader({ read }, { timeout, cancel });
  const holder: BodyHolder = {
    reader,
    total() {
      return total;
    },
  };
  const transformer = bodyParser(holder);
  return { ...reader, ...transformer };
}

function timeoutReader(
  r: Reader,
  opts?: {
    timeout: number;
    cancel?: Promise<void>;
  },
): Reader {
  if (!opts) return r;
  let timeoutOrCancel = promiseInterrupter(opts);
  return {
    async read(p: Uint8Array): Promise<number | EOF> {
      return await timeoutOrCancel(r.read(p));
    },
  };
}
