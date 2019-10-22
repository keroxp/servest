// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { ClientResponse } from "./server.ts";
import { assert } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { readResponse, writeRequest } from "./serveio.ts";
import { deferred } from "./vendor/https/deno.land/std/util/async.ts";
import { BufReader, BufWriter } from "./vendor/https/deno.land/std/io/bufio.ts";
import Conn = Deno.Conn;
import Reader = Deno.Reader;
import DialOptions = Deno.DialOptions;

/** keep-alive http agent for single host. each message will be sent in serial */
export interface HttpAgent {
  /** Hostname of host. deno.land of deno.land:80 */
  hostname: string;
  /** Port of host. 80 of deno.land:80 */
  port: number;
  /** send request to host. it throws EOF if conn is closed */
  send(opts: HttpAgentSendOptions): Promise<ClientResponse>;
  /** tcp connection for http agent */
  conn: Conn;
}

/** error that is thrown when tcp connection is closed */
export class ConnectionClosedError extends Error {}

export type HttpAgentOptions = {
  cancel?: Promise<void>;
  timeout?: number; // ms
};

/** http agent send options */
export type HttpAgentSendOptions = {
  /** relative path that continues after base url. must begin with /. include queries, hash */
  path: string;
  /** http method. */
  method: string;
  /** http headers */
  headers?: Headers;
  /** http body */
  body?: string | Uint8Array | Reader;
};

const kPortMap = {
  "http:": 80,
  "https:": 443
};

export function createAgent(
  baseUrl: string,
  opts: HttpAgentOptions = {}
): HttpAgent {
  let connected = false;
  let connecting = false;
  let _conn: Conn;
  let connectDeferred = deferred<void>();
  let bufReader: BufReader;
  let bufWriter: BufWriter;
  const url = new URL(baseUrl);
  assert(
    url.protocol === "http:" || url.protocol === "https:",
    `scheme must be http or https: ${url.protocol}`
  );
  const hostname = url.hostname;
  let port = url.port || kPortMap[url.protocol];
  assert(port !== void 0, `unexpected protocol: ${url.protocol}`);
  const connect = async () => {
    if (connected) return;
    if (connecting) return connectDeferred;
    connecting = true;
    const opts: DialOptions = {
      port: parseInt(port),
      transport: "tcp"
    };
    if (url.hostname) {
      opts.hostname = hostname;
    }
    if (url.protocol === "http:") {
      _conn = await Deno.dial(opts);
    } else {
      _conn = await Deno.dialTLS(opts);
    }
    bufReader = new BufReader(_conn);
    bufWriter = new BufWriter(_conn);
    connected = true;
    connecting = false;
    connectDeferred.resolve();
  };
  let prevResponse: ClientResponse;
  let sending = false;
  async function send(
    sendOptions: HttpAgentSendOptions
  ): Promise<ClientResponse> {
    if (sending) {
      throw new Error("It is not able to send http request concurrently");
    }
    sending = true;
    if (!connected) {
      await connect();
    }
    const { path, method, headers, body } = sendOptions;
    const destUrl = new URL(path, url);
    try {
      if (prevResponse) {
        await prevResponse.finalize();
      }
      await writeRequest(bufWriter, {
        url: destUrl.toString(),
        method,
        headers,
        body
      });
      const res = await readResponse(bufReader, opts);
      return (prevResponse = Object.assign(res, {
        bufWriter,
        bufReader,
        conn: _conn
      }));
    } catch (e) {
      if (e === Deno.EOF) {
        throw new ConnectionClosedError();
      } else {
        throw new Error(`${e}`);
      }
    } finally {
      sending = false;
    }
  }
  return {
    hostname,
    port,
    send,
    get conn() {
      return _conn;
    }
  };
}
