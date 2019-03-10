import { Reader, ReadResult } from "deno";
import { BufReader } from "https://deno.land/std@v0.3.1/io/bufio.ts";
import { TextProtoReader } from "https://deno.land/std@v0.3.1/textproto/mod.ts";

export interface Finalizer {
  finalize(): Promise<void>;
}

const nullBuffer = new Uint8Array(1024);
export async function readUntilEof(reader: Reader): Promise<number> {
  let total = 0;
  while (true) {
    const { eof, nread } = await reader.read(nullBuffer);
    total += nread;
    if (eof) {
      break;
    }
  }
  return total;
}

export class BodyReader implements Reader, Finalizer {
  total: number;

  constructor(readonly reader: Reader, readonly contentLength: number) {
    this.total = 0;
  }

  async read(p: Uint8Array): Promise<ReadResult> {
    const { nread } = await this.reader.read(p);
    this.total += nread;
    return { nread, eof: this.total === this.contentLength };
  }

  async finalize(): Promise<void> {
    if (this.total < this.contentLength) {
      try {
        await readUntilEof(this);
      } finally {
        this.total = this.contentLength;
      }
    }
  }
}

export class ChunkedBodyReader implements Reader, Finalizer {
  bufReader = new BufReader(this.reader);
  tpReader = new TextProtoReader(this.bufReader);

  constructor(private reader: Reader) {}

  chunks: Uint8Array[] = [];
  crlfBuf = new Uint8Array(2);
  finished: boolean = false;

  async read(p: Uint8Array): Promise<ReadResult> {
    const [line, sizeErr] = await this.tpReader.readLine();
    if (sizeErr) {
      throw sizeErr;
    }
    const len = parseInt(line, 16);
    if (len === 0) {
      this.finished = true;
      await this.bufReader.readFull(this.crlfBuf);
      return { nread: 0, eof: true };
    } else {
      const buf = new Uint8Array(len);
      await this.bufReader.readFull(buf);
      await this.bufReader.readFull(this.crlfBuf);
      this.chunks.push(buf);
    }
    const buf = this.chunks[0];
    if (buf) {
      if (buf.byteLength <= p.byteLength) {
        p.set(buf);
        this.chunks.shift();
        return { nread: buf.byteLength, eof: false };
      } else {
        p.set(buf.slice(0, p.byteLength));
        this.chunks[0] = buf.slice(p.byteLength, buf.byteLength);
        return { nread: p.byteLength, eof: false };
      }
    } else {
      return { nread: 0, eof: true };
    }
  }

  async finalize(): Promise<void> {
    if (!this.finished) {
      try {
        await readUntilEof(this);
      } finally {
        this.finished = true;
      }
    }
  }
}
