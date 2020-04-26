// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { promiseInterrupter } from "./promises.ts";

const nullBuffer = new Uint8Array(1024);

export interface BodyReader extends Deno.Reader {
  close(): Promise<void>;
}

export function closableBodyReader(r: Deno.Reader): BodyReader {
  return {
    read: r.read,
    async close() {
      await readUntilEof(r);
    },
  };
}

export async function readUntilEof(reader: Deno.Reader): Promise<number> {
  let total = 0;
  while (true) {
    const result = await reader.read(nullBuffer);
    if (result === Deno.EOF) {
      break;
    }
    total += result;
  }
  return total;
}

const kDefaultReadTimeout = 10000; // 10sec

export function timeoutReader(
  r: Deno.Reader,
  opts?: {
    timeout?: number;
    cancel?: Promise<void>;
  },
): Deno.Reader {
  if (!opts) return r;
  if (opts.timeout === undefined) {
    opts.timeout = kDefaultReadTimeout;
  }
  let timeoutOrCancel = promiseInterrupter(opts);
  return {
    async read(p: Uint8Array): Promise<number | Deno.EOF> {
      return await timeoutOrCancel(r.read(p));
    },
  };
}

export function streamReader(stream: ReadableStream<Uint8Array>): Deno.Reader {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  const read = async (p: Uint8Array): Promise<number | Deno.EOF> => {
    const set = (bytes: Uint8Array): number => {
      p.set(bytes);
      return bytes.byteLength;
    };
    const chunk = chunks.shift();
    if (chunk) {
      if (chunk.byteLength <= p.byteLength) {
        return set(chunk);
      } else {
        const ret = set(chunk.subarray(0, p.byteLength));
        chunks.unshift(chunk.subarray(p.byteLength));
        return ret;
      }
    }
    const { value, done } = await reader.read();
    if (done || !value) {
      return Deno.EOF;
    }
    if (value.byteLength <= p.byteLength) {
      return set(value);
    } else {
      const ret = set(value.subarray(0, p.byteLength));
      chunks.push(value.subarray(p.byteLength));
      return ret;
    }
  };
  return { read };
}
