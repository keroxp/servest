import { BufReader, BufWriter } from "https://deno.land/std@v0.3.1/io/bufio.ts";
import { readInt } from "https://deno.land/std@v0.3.1/io/ioutil.ts";
import { TextProtoReader } from "https://deno.land/std@v0.3.1/textproto/mod.ts";
import Buffer = Deno.Buffer;
import Conn = Deno.Conn;

type Http2Frame = {
  length: number;
  type: number;
  flags: number;
  streamId: number;
  payload: Uint8Array;
};

enum FrameType {
  DATA = 0x0,
  HEADERS = 0x1,
  PRIORITY = 0x2,
  RST_STREAM = 0x3,
  SETTINGS = 0x4,
  PUSH_PROMISE = 0x5,
  PING = 0x6,
  GOAWAY = 0x7,
  WINDOW_UPDATE = 0x8,
  CONTINUATION = 0x9
}

enum ErrorCode {
  NO_ERROR = 0x0,
  PROTOCOL_ERROR = 0x1,
  INTERNAL_ERROR = 0x2,
  FLOW_CONTROL_ERROR = 0x3,
  SETTINGS_TIMEOUT = 0x4,
  STREAM_CLOSED = 0x5,
  FRAME_SIZE_ERROR = 0x6,
  REFUSED_STREAM = 0x7,
  CANCEL = 0x8,
  COMPRESSION_ERROR = 0x9,
  CONNECT_ERROR = 0xa,
  ENHANCE_YOUR_CALM = 0xb,
  INADEQUATE_SECURITY = 0xc,
  HTTP_1_1_REQUIRED = 0xd
}

enum State {
  Idle,
  ReservedLocal,
  ReservedRemote,
  Open,
  HalfClosedLocal,
  HalfClosedRemote,
  Closed
}

enum SettingsId {
  SETTINGS_HEADER_TABLE_SIZE = 0x1,
  SETTINGS_ENABLE_PUSH = 0x2,
  SETTINGS_MAX_CONCURRENT_STREAMS = 0x3,
  SETTINGS_INITIAL_WINDOW_SIZE = 0x4,
  SETTINGS_MAX_FRAME_SIZE = 0x5,
  SETTINGS_MAX_HEADER_LIST_SIZE = 0x6
}

type StreamPriority = {
  dependency: number;
  exclusive: boolean;
  weight: number;
};

class Http2Stream {
  state = State.Idle;

  constructor(readonly id: number) {}

  readonly settings: { [id: number]: number } = {};
  remoteAppliedSettings = false;
  _headers?: Headers = null;
  get headers() {
    return this._headers;
  }

  _promisedRequestHeaders?: Headers = null;
  get promisedRequestHeaders() {
    return this._promisedRequestHeaders;
  }

  _data?: Buffer = null;
  get data() {
    return this._data;
  }

  readonly headerFragments: Uint8Array[] = [];
  readonly promisedReqeustHeaderFragments: Uint8Array[] = [];
  readonly dataFragments: Uint8Array[] = [];
  priority?: StreamPriority;
  closeCode?: number;

  private async _buildHeaders(arr: Uint8Array[]) {
    const length = arr.reduce((sum, arr) => sum + arr.byteLength, 0);
    const buf = new Uint8Array(length);
    let loc = 0;
    for (const frag of arr) {
      buf.set(frag, loc);
      loc += frag.byteLength;
    }
    const tpReader = new TextProtoReader(new BufReader(new Buffer(buf)));
    const [headers, err] = await tpReader.readMIMEHeader();
    return headers;
  }

  async buildHeaders() {
    return (this._headers = await this._buildHeaders(this.headerFragments));
  }

  async buildPromisedRequestHeaders() {
    this._promisedRequestHeaders = await this._buildHeaders(
      this.promisedReqeustHeaderFragments
    );
  }

  async buildData() {
    const length = this.dataFragments.reduce(
      (sum, arr) => sum + arr.byteLength,
      0
    );
    const buf = new Uint8Array(length);
    let loc = 0;
    for (const frag of this.dataFragments) {
      buf.set(frag, loc);
      loc += frag.byteLength;
    }
    this._data = new Buffer(buf);
  }
}

class Http2ConnectionImpl {
  private reader = new BufReader(this.conn);
  private writer = new BufWriter(this.conn);
  private streams: { [id: number]: Http2Stream } = {};

  constructor(private conn: Conn) {}

  async *receive() {
    while (true) {
      const frame = await readFrame(this.reader);
      const stream =
        this.streams[frame.streamId] || new Http2Stream(frame.streamId);
      if (frame.type === FrameType.DATA) {
        await this.readDataFrame(stream, frame);
      } else if (frame.type === FrameType.HEADERS) {
        await this.readHeadersFrame(stream, frame);
      } else if (frame.type === FrameType.PRIORITY) {
        await this.readPriorityFrame(stream, frame);
      } else if (frame.type === FrameType.RST_STREAM) {
        await this.readResetFrame(stream, frame);
      } else if (frame.type === FrameType.SETTINGS) {
        await this.readSettingFrame(stream, frame);
      } else if (frame.type === FrameType.PUSH_PROMISE) {
        const { stream } = await this.readPushPromise(frame);
        this.streams[stream.id] = stream;
      } else if (frame.type === FrameType.PING) {
      } else if (frame.type === FrameType.GOAWAY) {
      } else if (frame.type === FrameType.WINDOW_UPDATE) {
      } else if (frame.type === FrameType.CONTINUATION) {
        await this.readContinuation(stream, frame);
      }
      yield null;
    }
  }

  async readDataFrame(
    stream: Http2Stream,
    frame: Http2Frame
  ): Promise<Buffer | null> {
    const reader = new BufReader(new Buffer(frame.payload));
    let dataLength = frame.length;
    if (frame.flags & 0x1) {
      const padLength = (await readInt(reader)) >>> 24;
      dataLength -= 32 + padLength;
    }
    const data = new Uint8Array(dataLength);
    await reader.readFull(data);
    if (frame.flags & 0x1) {
      await stream.buildData();
    }
    return stream.data;
  }

  async readHeadersFrame(
    stream: Http2Stream,
    frame: Http2Frame
  ): Promise<Headers | null> {
    const reader = new BufReader(new Buffer(frame.payload));
    let fragmentLength = frame.length;
    if (stream.state === State.Idle) {
      stream.state = State.Open;
    } else if (stream.state === State.ReservedRemote) {
      stream.state = State.HalfClosedLocal;
    } else if (stream.state === State.HalfClosedRemote && frame.flags & 0x1) {
      // END_STREAM
      stream.state = State.Closed;
    }
    if (frame.flags & 0x8) {
      // PADDED
      const padLength = (await readInt(reader)) >>> 24;
      fragmentLength -= 32 + padLength;
    }
    if (frame.flags & 0x20) {
      // PRIORITY
      const v = await readInt(reader);
      const dependency = (v << 1) >>> 1;
      const exclusive = v >>> 31 === 1;
      const weight = (await readInt(reader)) >>> 24;
      stream.priority = {
        dependency,
        exclusive,
        weight
      };
    }
    const buf = new Uint8Array(fragmentLength);
    await reader.readFull(buf);
    stream.headerFragments.push(buf);
    if (frame.flags & 0x4) {
      // END_HEADERS
      await stream.buildHeaders();
    }
    return stream.headers;
  }

  async readPriorityFrame(
    stream: Http2Stream,
    frame: Http2Frame
  ): Promise<StreamPriority> {
    const buf = new BufReader(new Buffer(frame.payload));
    const _dependency = await readInt(buf);
    const dependency = (_dependency << 1) >>> 1;
    const exclusive = _dependency >>> 31 === 1;
    const weight = (await readInt(buf)) >>> 24;
    return (stream.priority = { dependency, exclusive, weight });
  }

  async readResetFrame(
    stream: Http2Stream,
    frame: Http2Frame
  ): Promise<number> {
    stream.state = State.Closed;
    let code = 0;
    for (let i = 0; i < 4; i++) {
      code &= frame.payload[i];
      code <<= 8;
    }
    return (stream.closeCode = code);
  }

  async readPushPromise(
    frame: Http2Frame
  ): Promise<{
    stream: Http2Stream;
    requestHeader: Headers;
  }> {
    const reader = new BufReader(new Buffer(frame.payload));
    let fragmentLength = frame.length;
    if (frame.flags & 0x8) {
      // PADDED
      const padLength = (await readInt(reader)) >>> 24;
      fragmentLength -= 32 + padLength;
    }
    const streamId = ((await readInt(reader)) << 1) >>> 1;
    const fragment = new Uint8Array(fragmentLength);
    await reader.readFull(fragment);
    const stream = (this.streams[streamId] = new Http2Stream(streamId));
    stream.state = State.ReservedRemote;
    stream.promisedReqeustHeaderFragments.push(fragment);
    while (true) {
      let cont = await readFrame(this.reader);
      // MUST be CONTINUATION frame
      await this.readContinuation(stream, cont);
      if (cont.flags & 0x4) {
        await stream.buildHeaders();
        break;
      }
    }
    return { stream, requestHeader: stream.promisedRequestHeaders };
  }

  async readSettingFrame(stream: Http2Stream, frame: Http2Frame) {
    const reader = new BufReader(new Buffer(frame.payload));
    if (frame.flags & 0x1) {
      // ACK
      stream.remoteAppliedSettings = true;
      return;
    }
    const numParams = frame.length / 8;
    for (let i = 0; i < numParams; i++) {
      const id = (await readInt(reader)) >>> 16;
      const value = await readInt(reader);
      stream.settings[id] = value;
    }
    // send Ack
  }

  async readPing(stream: Http2Stream, frame: Http2Frame): Promise<Uint8Array> {
    const buf = new Uint8Array(64);
    await this.reader.readFull(buf);
    if (frame.flags & 0x1) {
      // ACK
    } else {
      // send Ack
    }
    return buf;
  }

  async readGoaway(stream: Http2Stream, frame: Http2Frame) {
    const reader = new BufReader(new Buffer(frame.payload));
    const lastStreamId = ((await readInt(reader)) << 1) >>> 1;
    const errorCode = await readInt(reader);
  }

  async readWindowUpdate(stream: Http2Stream, frame: Http2Frame) {
    const reader = new BufReader(new Buffer(frame.payload));
    const windowSizeIncrement = ((await readInt(reader)) << 1) >>> 1;
  }

  async readContinuation(
    stream: Http2Stream,
    frame: Http2Frame
  ): Promise<Headers | null> {
    stream.headerFragments.push(frame.payload);
    if (frame.flags & 0x4) {
      // END_HEADERS
      await stream.buildHeaders();
    }
    return stream.headers;
  }
}

async function readFrame(reader: BufReader): Promise<Http2Frame> {
  const header = new Uint8Array(96);
  await reader.read(header);
  const length = (await readInt(reader)) >>> 8;
  const type = await reader.readByte();
  const flags = await reader.readByte();
  const streamId = (await readInt(reader)) % 0x7fffffff;
  const payload = new Uint8Array(length);
  await reader.readFull(payload);
  return { length, type, flags, streamId, payload };
}

async function* handleHttp2(params: {
  url: string;
  method: "GET" | "POST" | "HEAD" | "OPTION" | "DELETE" | "PUT" | "PATCH";
  auth?: {
    username: string;
    password: string;
  };
  data?: string | { [key: string]: string };
  headers?: Headers;
}) {
  // return http2 connection
  yield null;
}
