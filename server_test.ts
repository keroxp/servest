// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import {
  handleKeepAliveConn,
  listenAndServe,
  ServerRequest,
} from "./server.ts";
import {
  assertEquals,
  assertThrowsAsync,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { encode } from "./vendor/https/deno.land/std/encoding/utf8.ts";
import { createAgent } from "./agent.ts";
import { readResponse, writeRequest } from "./serveio.ts";
import { BufReader } from "./vendor/https/deno.land/std/io/bufio.ts";
import { deferred, delay } from "./vendor/https/deno.land/std/util/async.ts";
import Buffer = Deno.Buffer;
import { group } from "./test_util.ts";

let port = 8880;
const handler = (req: ServerRequest) =>
  req.respond({ status: 200, body: "ok" });
group("server", (t) => {
  t.test("basic", async function server() {
    port++;
    const listener = listenAndServe({ port }, handler);
    const agent = createAgent("http://127.0.0.1:" + port);
    try {
      const { headers, status, text } = await agent.send({
        path: "/",
        method: "GET",
      });
      assertEquals(headers.get("content-length"), "2");
      assertEquals(status, 200);
      assertEquals(headers.get("content-type"), "text/plain; charset=UTF-8");
      assertEquals(await text(), "ok");
    } finally {
      agent.conn.close();
      listener.close();
    }
  });
  t.test("keepAliveTimeout", async () => {
    port++;
    const l = listenAndServe(
      { port },
      handler,
      { keepAliveTimeout: 10 },
    );
    const agent = createAgent(`http://127.0.0.1:${port}`);
    try {
      const req = {
        path: "/",
        method: "POST",
        headers: new Headers({
          host: "deno.land",
        }),
        body: "hello",
      };
      const { status, body } = await agent.send(req);
      await body.close();
      assertEquals(200, status);
      await delay(100);
      await assertThrowsAsync(async () => {
        await agent.send(req);
      });
    } finally {
      agent.conn.close();
      l.close();
    }
  });
  t.test(
    "serverKeepAliveTimeoutMax",
    async function serverKeepAliveTimeoutMax() {
      port++;
      const listener = listenAndServe({ port }, handler);
      const agent = createAgent(`http://127.0.0.1:${port}`);
      try {
        const req = {
          path: "/",
          method: "POST",
          headers: new Headers({
            host: "deno.land",
            "Keep-Alive": "max=0, timeout=1000",
          }),
          body: encode("hello"),
        };
        const { status, body } = await agent.send(req);
        await body.close();
        assertEquals(200, status);
        await assertThrowsAsync(async () => {
          await agent.send(req);
        });
      } finally {
        agent.conn.close();
        listener.close();
      }
    },
  );
  t.test("serverConnectionClose", async function serverConnectionClose() {
    port++;
    const listener = listenAndServe({ port }, handler);
    const agent = createAgent(`http://127.0.0.1:${port}`);
    try {
      const req = {
        path: "/",
        method: "POST",
        headers: new Headers({
          host: "deno.land",
          connection: "close",
        }),
        body: "hello",
      };
      const { status, body } = await agent.send(req);
      await body.close();
      assertEquals(200, status);
      await assertThrowsAsync(async () => {
        await agent.send(req);
      });
    } finally {
      agent.conn.close();
      listener.close();
    }
  });
  t.test("handleKeepAliveConn should respond exclusively", async () => {
    const r = new Buffer();
    const w = new Buffer();
    await writeRequest(r, {
      method: "GET",
      url: "http://localhost/?q=1",
    });
    await writeRequest(r, {
      method: "GET",
      url: "http://localhost/?q=2",
    });
    await writeRequest(r, {
      method: "GET",
      url: "http://localhost/?q=3",
    });
    const d = deferred<void>();
    let latch = 3;
    handleKeepAliveConn(dummyConn(r, w), async (req) => {
      const url = new URL(req.url, "http://dummy");
      const i = url.searchParams.get("q")!;
      req.respond({ status: 200, body: "resp:" + i }).then(() => {
        if (--latch === 0) {
          d.resolve();
        }
      });
    });
    await d;
    const responseReader = new BufReader(w);
    const resp1 = await readResponse(responseReader);
    assertEquals(await resp1.text(), "resp:1");
    const resp2 = await readResponse(responseReader);
    assertEquals(await resp2.text(), "resp:2");
    const resp3 = await readResponse(responseReader);
    assertEquals(await resp3.text(), "resp:3");
  });
});

function dummyConn(r: Deno.Reader, w: Deno.Writer): Deno.Conn {
  const addr: Deno.Addr = { hostname: "0.0.0.0", port: 1, transport: "tcp" };
  return {
    rid: -1,
    close(): void {},
    closeWrite(): void {},
    localAddr: addr,
    remoteAddr: addr,
    read: (p) => r.read(p),
    write: (p) => w.write(p),
  };
}
