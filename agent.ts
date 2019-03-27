// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { ClientRequest, ClientResponse } from "./server.ts";
import { assert } from "https://deno.land/std@v0.3.2/testing/asserts.ts";
import { defer, Deferred } from "./promises.ts";
import { readResponse, writeRequest } from "./serveio.ts";
import Conn = Deno.Conn;
import { BufReader, BufWriter } from "https://deno.land/std@v0.3.2/io/bufio.ts";
import Reader = Deno.Reader;

/** keep-alive http agent for single host. each message will be sent in serial */
export interface HttpAgent {
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
  body?: Uint8Array | Reader;
};

const kPortMap = {
  "http:": 80,
  "https:": 443
};

export function createAgent(
  baseUrl: string,
  opts?: HttpAgentOptions
): HttpAgent {
  let connected = false;
  let connecting = false;
  let _conn: Conn;
  let connectDeferred = defer();
  let bufReader: BufReader;
  let bufWriter: BufWriter;
  const url = new URL(baseUrl);
  assert(url.protocol !== "https:", "https is not supported yet");
  assert(
    url.protocol === "http:" || url.protocol === "https:",
    `scheme must be http or https: ${url.protocol}`
  );
  let port = url.port || kPortMap[url.protocol];
  assert(port !== void 0, `unexpected protocol: ${url.protocol}`);
  const connect = async () => {
    if (connected) return;
    if (connecting) return connectDeferred.promise;
    connecting = true;
    const host = url.hostname;
    _conn = await Deno.dial("tcp", `${host}:${port}`);
    bufReader = new BufReader(_conn);
    bufWriter = new BufWriter(_conn);
    connected = true;
    connecting = false;
    connectDeferred.resolve();
  };
  let prevResponse: ClientResponse;
  let sending = false;
  const send = async (
    sendOptions?: HttpAgentSendOptions
  ): Promise<ClientResponse> => {
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
      await writeRequest(_conn, {
        url: destUrl.toString(),
        method,
        headers,
        body
      });
      const res = await readResponse(_conn, opts);
      return (prevResponse = Object.assign(res, {
        bufWriter,
        bufReader,
        conn: _conn
      }));
    } catch (e) {
      if (e === "EOF") {
        throw new ConnectionClosedError();
      } else {
        throw new Error(`${e}`);
      }
    } finally {
      sending = false;
    }
  };
  return {
    send,
    get conn() {
      return _conn;
    }
  };
}
