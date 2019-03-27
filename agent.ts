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
  send(path: string, opts?: HttpAgentSendOptions): Promise<ClientResponse>;

  /** tcp connection for http agent */
  conn: Conn;
}

export class ConnectionClosedError extends Error {}

export type HttpAgentSendOptions = {
  method: string;
  headers?: Headers;
  body?: Uint8Array | Reader;
};

export type HttpAgentOptions = {
  cancel?: Promise<void>;
  timeout?: number; // ms
};

const kPortMap = {
  http: 80,
  https: 443
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
  const connect = async () => {
    if (connected) return;
    if (connecting) return connectDeferred.promise;
    connecting = true;
    const host = url.hostname;
    let port = url.port || kPortMap[url.protocol];
    assert(port !== void 0, `unexpected protocol: ${url.protocol}`);
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
    path: string,
    sendOptions?: HttpAgentSendOptions
  ): Promise<ClientResponse> => {
    if (sending) {
      throw new Error("It is not able to send http request concurrently");
    }
    sending = true;
    if (!connected) {
      await connect();
    }
    const destUrl = new URL(path, url);
    try {
      if (prevResponse) {
        await prevResponse.finalize();
      }
      await writeRequest(
        _conn,
        Object.assign(
          {
            url: destUrl.toString()
          },
          sendOptions
        )
      );
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
