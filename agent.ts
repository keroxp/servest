// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { ClientResponse, HttpBody } from "./server.ts";
import { assert } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { readResponse, writeRequest } from "./serveio.ts";
import { deferred } from "./vendor/https/deno.land/std/async/mod.ts";
import {
  BufReader,
  BufWriter,
} from "./vendor/https/deno.land/std/io/bufio.ts";
import { UnexpectedEofError, ConnectionClosedError } from "./error.ts";

/** keep-alive http agent for single host. each message will be sent in serial */
export interface Agent {
  /** Hostname of host. deno.land of deno.land:80 */
  hostname: string;
  /** Port of host. 80 of deno.land:80 */
  port: number;
  /** send request to host. it throws EOF if conn is closed */
  send(opts: AgentSendOptions): Promise<ClientResponse>;
  /** tcp connection for http agent */
  conn: Deno.Conn;
}

export interface AgentOptions {
  cancel?: Promise<void>;
  timeout?: number; // ms
}/** http agent send options */

export interface AgentSendOptions {
  /** relative path that continues after base url. must begin with /. include queries, hash */
  path: string;
  /** http method. */
  method: string;
  /** http headers */
  headers?: Headers;
  /** http body */
  body?: HttpBody;
}

const kPortMap = {
  "http:": 80,
  "https:": 443,
};

export function createAgent(
  baseUrl: string,
  opts: AgentOptions = {},
): Agent {
  let connected = false;
  let connecting = false;
  let _conn: Deno.Conn;
  let connectDeferred = deferred<void>();
  let bufReader: BufReader;
  let bufWriter: BufWriter;
  const url = new URL(baseUrl);
  assert(
    url.protocol === "http:" || url.protocol === "https:",
    `scheme must be http or https: ${url.protocol}`,
  );
  const hostname = url.hostname;
  let port = url.port ? parseInt(url.port) : kPortMap[url.protocol];
  assert(port !== void 0, `unexpected protocol: ${url.protocol}`);
  const connect = async () => {
    if (connected) return;
    if (connecting) return connectDeferred;
    connecting = true;
    const opts: Deno.ConnectOptions = {
      port,
      transport: "tcp",
    };
    if (url.hostname) {
      opts.hostname = hostname;
    }
    if (url.protocol === "http:") {
      _conn = await Deno.connect(opts);
    } else {
      _conn = await Deno.connectTls(opts);
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
    sendOptions: AgentSendOptions,
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
        await prevResponse.body.close();
      }
      await writeRequest(bufWriter, {
        url: destUrl.toString(),
        method,
        headers,
        body,
      });
      const res = await readResponse(bufReader, opts);
      return (prevResponse = Object.assign(res, {
        bufWriter,
        bufReader,
        conn: _conn,
      }));
    } catch (e) {
      if (e instanceof UnexpectedEofError) {
        throw new ConnectionClosedError();
      } else {
        throw e;
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
    },
  };
}
