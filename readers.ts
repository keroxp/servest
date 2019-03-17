// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import {Reader, ReadResult} from "deno";
import {BufReader} from "https://deno.land/std@v0.3.1/io/bufio.ts";
import {TextProtoReader} from "https://deno.land/std@v0.3.1/textproto/mod.ts";
import {wait} from "./util.ts";

const nullBuffer = new Uint8Array(1024);

export async function readUntilEof(reader: Reader): Promise<number> {
  let total = 0;
  while (true) {
    const {eof, nread} = await reader.read(nullBuffer);
    total += nread;
    if (eof) {
      break;
    }
  }
  return total;
}

export class BodyReader implements Reader {
  total: number;

  constructor(readonly reader: Reader,
              readonly contentLength: number) {
    this.total = 0;
  }

  async read(p: Uint8Array): Promise<ReadResult> {
    const {nread} = await this.reader.read(p);
    this.total += nread;
    const eof = this.total === this.contentLength;
    return {nread, eof};
  }
}

export class ChunkedBodyReader implements Reader {
  bufReader: BufReader;
  tpReader: TextProtoReader;

  constructor(private reader: Reader) {
    this.bufReader = reader instanceof BufReader
      ? reader
      : new BufReader(reader);
    this.tpReader = new TextProtoReader(this.bufReader);
  }

  chunks: Uint8Array[] = [];
  crlfBuf = new Uint8Array(2);
  finished: boolean = false;

  async read(p: Uint8Array): Promise<ReadResult> {
    if (this.finished) {
      return {eof: true, nread: 0}
    }
    const [line, sizeErr] = await this.tpReader.readLine();
    if (sizeErr) {
      throw sizeErr;
    }
    const len = parseInt(line, 16);
    let nread, state;
    if (len === 0) {
      this.finished = true;
      [nread, state] = await this.bufReader.readFull(this.crlfBuf);
      if (state) {
        throw state;
      }
      return {nread: 0, eof: true};
    } else {
      const buf = new Uint8Array(len + 2);
      [nread, state] = await this.bufReader.readFull(buf);
      if (state) {
        throw state
      }
      this.chunks.push(buf.slice(0, len));
    }
    const buf = this.chunks[0];
    if (buf.byteLength <= p.byteLength) {
      p.set(buf);
      this.chunks.shift();
      return {nread: buf.byteLength, eof: false};
    } else {
      p.set(buf.slice(0, p.byteLength));
      this.chunks[0] = buf.slice(p.byteLength, buf.byteLength);
      return {nread: p.byteLength, eof: false};
    }
  }
}

export class TimeoutReader implements Reader {
  constructor(private readonly r: Reader, private readonly timeoutMs: number) {
  }

  async read(p: Uint8Array): Promise<ReadResult> {
    const res = await Promise.race([
      this.r.read(p),
      wait(this.timeoutMs, void 0),
    ]);
    if (!res) {
      throw new Error("read timeout");
    }
    return res;
  }
}
