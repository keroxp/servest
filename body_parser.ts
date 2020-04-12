// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import {
  FormFile,
  isFormFile,
  MultipartReader,
} from "./vendor/https/deno.land/std/mime/multipart.ts";
import Reader = Deno.Reader;

export interface FormBody {
  field(field: string): string | undefined;
  file(field: string): FormFile | undefined;
  removeAllTempFiles(): Promise<void>;
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
): Promise<FormBody> {
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
  const form = await reader.readForm(maxMemory);
  return {
    field(field: string): string | undefined {
      const v = form[field];
      if (typeof v === "string") {
        return v;
      }
    },
    file(field: string): FormFile | undefined {
      const v = form[field];
      if (isFormFile(v)) {
        return v;
      }
    },
    async removeAllTempFiles(): Promise<void> {
      const arr = Object.values(form).filter(isFormFile) as FormFile[];
      const promises: Promise<void>[] = [];
      for (const v of arr) {
        const { tempfile } = v;
        if (tempfile) {
          promises.push(
            (async () => {
              try {
                const stat = await Deno.stat(tempfile);
                if (stat.isFile()) {
                  await Deno.remove(tempfile);
                }
              } catch (e) {}
            })(),
          );
        }
      }
      await Promise.all(promises);
    },
  };
}
/**
 * Parse application/x-www-form-urlencoded request
 * @param req part of ServerRequest
 */
export async function parseUrlEncodedForm(req: {
  headers: Headers;
  body?: Reader;
}): Promise<FormBody> {
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
  return {
    field(field: string): string | undefined {
      return params.get(field) || undefined;
    },
    file(field: string): FormFile | undefined {
      return undefined;
    },
    async removeAllTempFiles(): Promise<void> {},
  };
}
