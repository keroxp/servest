// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import {
  MultipartReader,
  MultipartFormData,
} from "./vendor/https/deno.land/std/mime/multipart.ts";
import Reader = Deno.Reader;

export interface BodyParser {
  text(): Promise<string>;
  json(): Promise<any>;
  arrayBuffer(): Promise<Uint8Array>;
  formData(): Promise<MultipartFormData>;
}

export function createBodyParser(holder: {
  readonly reader: Deno.Reader;
  readonly contentType: string;
  readonly maxMemory?: number;
}): BodyParser {
  let bodyBuf: Deno.Buffer | undefined;
  let formBody: MultipartFormData | undefined;
  let textBody: string | undefined;
  let jsonBody: any | undefined;
  async function formDataInternal(
    contentType: string,
    body: Reader,
    maxMemory?: number,
  ): Promise<MultipartFormData> {
    const headers = new Headers({
      "content-type": contentType,
    });
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
  async function formData(): Promise<MultipartFormData> {
    const { contentType, reader, maxMemory } = holder;
    if (formBody) {
      return formBody;
    } else if (bodyBuf) {
      return (formBody = await formDataInternal(
        contentType,
        bodyBuf,
        maxMemory,
      ));
    }
    return (formBody = await formDataInternal(
      contentType,
      reader,
      maxMemory,
    ));
  }

  async function json<T>(): Promise<T> {
    if (jsonBody) {
      return jsonBody as T;
    } else if (bodyBuf) {
      return (jsonBody = JSON.parse(bodyBuf.toString()));
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
    bodyBuf = new Deno.Buffer();
    await Deno.copy(bodyBuf, holder.reader);
    return (textBody = bodyBuf.toString());
  }

  async function arrayBuffer(): Promise<Uint8Array> {
    if (bodyBuf) {
      return bodyBuf.bytes();
    }
    bodyBuf = new Deno.Buffer();
    await Deno.copy(bodyBuf, holder.reader);
    return bodyBuf.bytes();
  }
  return { json, text, formData, arrayBuffer };
}

/**
 * Parse multipart/form-data request
 * @param req ServerRequest
 * @param maxMemory maximum memory size for file part.
 *  Small file will be stored in memory, Big file in tempfile
 */
export async function parserMultipartRequest(
  req: { headers: Headers; body?: Reader },
  maxMemory: number = 1 << 10, // 10MB by default
): Promise<MultipartFormData> {
  // Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryO5quBRiT4G7Vm3R7
  const contentType = req.headers.get("content-type");
  if (!req.body) {
    throw new Error("request has no body");
  }
  if (!contentType || !contentType.match("multipart/form-data")) {
    throw new Error("is not multipart request");
  }
  let m = contentType.match(/boundary=([^ ]+?)$/);
  if (!m) {
    throw new Error("doesn't have boundary");
  }
  const boundary = m[1];
  const reader = new MultipartReader(req.body, boundary);
  return reader.readForm(maxMemory);
}
/**
 * Parse application/x-www-form-urlencoded request
 * @param req part of ServerRequest
 */
export async function parseUrlEncodedForm(req: {
  headers: Headers;
  body?: Reader;
}): Promise<MultipartFormData> {
  const contentType = req.headers.get("content-type");
  if (!req.body) {
    throw new Error("request has no body");
  }
  if (
    !contentType ||
    !contentType.match(/^application\/x-www-form-urlencoded/)
  ) {
    throw new Error("is not form urlencoded request");
  }
  const buf = new Deno.Buffer();
  await Deno.copy(buf, req.body);
  const params = new URLSearchParams(decodeURIComponent(buf.toString()));
  function* entries() {
    for (const i of params.entries()) {
      yield i;
    }
  }
  return {
    value(f: string) {
      return params.get(f) ?? undefined;
    },
    entries,
    [Symbol.iterator]() {
      return entries();
    },
    file(f: string) {
      return undefined;
    },
    async removeAll() {
    },
  };
}
