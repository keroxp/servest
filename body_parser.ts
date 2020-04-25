// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import {
  MultipartReader,
  MultipartFormData,
} from "./vendor/https/deno.land/std/mime/multipart.ts";
import Reader = Deno.Reader;

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
