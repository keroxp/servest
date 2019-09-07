// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { BufReader } from "https://deno.land/std@v0.17.0/io/bufio.ts";
import { TextProtoReader } from "https://deno.land/std@v0.17.0/textproto/mod.ts";
import { promiseInterrupter } from "./promises.ts";
import Reader = Deno.Reader;
import EOF = Deno.EOF;

const nullBuffer = new Uint8Array(1024);

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

export class BodyReader implements Reader {
  total: number;

  constructor(readonly reader: Reader, readonly contentLength: number) {
    this.total = 0;
  }

  async read(p: Uint8Array): Promise<number | EOF> {
    const remaining = this.contentLength - this.total;
    let buf = p;
    if (p.byteLength > remaining) {
      buf = new Uint8Array(remaining);
    }
    let result = await this.reader.read(buf);
    if (buf !== p) {
      p.set(buf);
    }
    let eof = result === EOF || this.total === this.contentLength;
    if (result !== EOF) {
      this.total += result;
    }
    return eof ? EOF : result;
  }
}

export class ChunkedBodyReader implements Reader {
  bufReader: BufReader;
  tpReader: TextProtoReader;

  constructor(private reader: Reader) {
    this.bufReader =
      reader instanceof BufReader ? reader : new BufReader(reader);
    this.tpReader = new TextProtoReader(this.bufReader);
  }

  chunks: Uint8Array[] = [];
  crlfBuf = new Uint8Array(2);
  finished: boolean = false;

  async read(p: Uint8Array): Promise<number | EOF> {
    if (this.finished) {
      return EOF;
    }
    const line = await this.tpReader.readLine();
    if (line === EOF) {
      return EOF;
    }
    const len = parseInt(line, 16);
    if (len === 0) {
      this.finished = true;
      await this.bufReader.readFull(this.crlfBuf);
      return EOF;
    } else {
      const buf = new Uint8Array(len + 2);
      const res = await this.bufReader.readFull(buf);
      if (res === EOF) {
        return EOF;
      }
      this.chunks.push(buf.slice(0, len));
    }
    const buf = this.chunks[0];
    if (buf.byteLength <= p.byteLength) {
      p.set(buf);
      this.chunks.shift();
      return buf.byteLength;
    } else {
      p.set(buf.slice(0, p.byteLength));
      this.chunks[0] = buf.slice(p.byteLength, buf.byteLength);
      return p.byteLength;
    }
  }
}

export class TimeoutReader implements Reader {
  timeoutOrCancel: (p: Promise<number | EOF>) => Promise<number | EOF>;

  constructor(
    private readonly r: Reader,
    opts: {
      timeout: number;
      cancel?: Promise<void>;
    }
  ) {
    this.timeoutOrCancel = promiseInterrupter(opts);
  }

  async read(p: Uint8Array): Promise<number | EOF> {
    return await this.timeoutOrCancel(this.r.read(p));
  }
}
