// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { IncomingHttpRequest } from "./server.ts";
import { MultipartReader } from "https://deno.land/std@v0.3.1/multipart/multipart.ts";
import { FormFile } from "https://deno.land/std@v0.3.1/multipart/formfile.ts";
import Buffer = Deno.Buffer;
import copy = Deno.copy;
import { assert } from "https://deno.land/std@v0.3.1/testing/asserts.ts";

export type RequestMapper<V> = (req: IncomingHttpRequest) => Promise<V>;

function formData(): RequestMapper<{ [key: string]: FormFile | string }> {
  return async req => {
    const { headers, body } = req;
    if (!body) {
      throw new Error("body is not present");
    }
    const contentType = headers.get("content-type");
    if (contentType.match(/^multipart\/form-data/)) {
      const [_, boundary] = contentType.trim().match(/boundary=(.+?)$/);
      assert(
        boundary !== void 0,
        `boundary is not present in Content-Type: ${contentType}`
      );
      const r = new MultipartReader(body, boundary);
      return r.readForm(10 << 20);
    } else if (contentType.match(/^application\/x-www-form-urlencoded/)) {
      const buf = new Buffer();
      await copy(buf, body);
      const data = Object.create(null);
      buf
        .toString()
        .split("&")
        .map(kv => kv.split("="))
        .forEach(([k, v]) => (data[k] = v));
      return data;
    } else {
      throw new Error(
        `content-type is not parsable for form data: ${contentType}`
      );
    }
  };
}

export function json<J = { [key: string]: string }>(): RequestMapper<J> {
  return async req => {
    const { headers, body } = req;
    if (!body) {
      throw new Error("body is not present");
    }
    const contentType = headers.get("content-type");
    if (!contentType.match(/^application\/json/)) {
      throw new Error(`content-type is not parsable for json: ${contentType}`);
    }
    const buf = new Buffer();
    await copy(buf, body);
    return JSON.parse(buf.toString());
  };
}

export function text(opts?: {
  types?: (RegExp | string)[];
}): RequestMapper<string> {
  return async req => {
    const { headers, body } = req;
    if (!body) {
      throw new Error("body is not present");
    }
    const contentType = headers.get("content-type");
    const types = (opts && opts.types) || [/^text\/plain/];
    for (const t of types) {
      if (contentType.match(t)) {
        const buf = new Buffer();
        await copy(buf, body);
        return buf.toString();
      }
    }
    throw new Error(`content-type is not parsable for text: ${contentType}`);
  };
}
