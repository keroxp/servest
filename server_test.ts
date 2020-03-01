// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { handleKeepAliveConn, listenAndServe } from "./server.ts";
import { StringReader } from "./vendor/https/deno.land/std/io/readers.ts";
import { StringWriter } from "./vendor/https/deno.land/std/io/writers.ts";
import {
  assertEquals,
  assertThrowsAsync
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { encode } from "./vendor/https/deno.land/std/strings/encode.ts";
import { createAgent } from "./agent.ts";
import { readResponse, writeRequest } from "./serveio.ts";
import { BufReader } from "./vendor/https/deno.land/std/io/bufio.ts";
import { deferred } from "./vendor/https/deno.land/std/util/async.ts";
import Buffer = Deno.Buffer;
let port = 8880;
const { test } = Deno;

test(async function server() {
  const listener = listenAndServe(
    {
      hostname: "0.0.0.0",
      port
    },
    async req => {
      await req.respond({
        status: 200,
        headers: new Headers({
          "content-type": "text/plain",
          "content-length": "5"
        }),
        body: new StringReader("hello")
      });
    }
  );
  const agent = createAgent("http://127.0.0.1:" + port);
  try {
    const { headers, status, body } = await agent.send({
      path: "/",
      method: "GET"
    });
    assertEquals(headers.get("content-length"), "5");
    assertEquals(status, 200);
    assertEquals(headers.get("content-type"), "text/plain");
    const dest = new StringWriter();
    await Deno.copy(dest, body);
    assertEquals(dest.toString(), "hello");
  } finally {
    agent.conn.close();
    listener.close();
  }
});
/*
it("server", t => {
  port++;
  t.beforeAfterAll(() => {
    const l = listenAndServe(
      { port },
      async req => {
        await req.respond({
          status: 200,
          body: "ok"
        });
      },
      {
        keepAliveTimeout: 10
      }
    );
    return () => l.close();
  });
  t.run("keepAliveTimeout", async () => {
    const agent = createAgent(`http://127.0.0.1:${port}`);
    try {
      const req = {
        path: "/",
        method: "POST",
        headers: new Headers({
          host: "deno.land"
        }),
        body: "hello"
      };
      const { status, finalize } = await agent.send(req);
      await finalize();
      assertEquals(200, status);
      await delay(100);
      await assertThrowsAsync(async () => {
        await agent.send(req);
      });
    } finally {
      agent.conn.close();
    }
  });
});
 */
test(async function serverKeepAliveTimeoutMax() {
  port++;
  const listener = listenAndServe(
    {
      hostname: "0.0.0.0",
      port
    },
    async req => {
      await req.respond({
        status: 200,
        headers: new Headers(),
        body: encode("ok")
      });
    }
  );
  const agent = createAgent(`http://127.0.0.1:${port}`);
  try {
    const req = {
      path: "/",
      method: "POST",
      headers: new Headers({
        host: "deno.land",
        "Keep-Alive": "max=0, timeout=1000"
      }),
      body: encode("hello")
    };
    const { status, finalize } = await agent.send(req);
    await finalize();
    assertEquals(200, status);
    await assertThrowsAsync(async () => {
      await agent.send(req);
    });
  } finally {
    agent.conn.close();
    listener.close();
  }
});

test(async function serverConnectionClose() {
  port++;
  const listener = listenAndServe(
    {
      hostname: "0.0.0.0",
      port
    },
    async req => {
      await req.respond({
        status: 200,
        headers: new Headers(),
        body: encode("ok")
      });
    }
  );
  const agent = createAgent(`http://127.0.0.1:${port}`);
  try {
    const req = {
      path: "/",
      method: "POST",
      headers: new Headers({
        host: "deno.land",
        connection: "close"
      }),
      body: encode("hello")
    };
    const { status, finalize } = await agent.send(req);
    await finalize();
    assertEquals(200, status);
    await assertThrowsAsync(async () => {
      await agent.send(req);
    });
  } finally {
    agent.conn.close();
    listener.close();
  }
});

function dummyConn(r: Deno.Reader, w: Deno.Writer): Deno.Conn {
  const addr: Deno.Addr = { hostname: "0.0.0.0", port: 1, transport: "tcp" };
  return {
    rid: -1,
    close(): void {},
    closeWrite(): void {},
    closeRead(): void {},
    localAddr: addr,
    remoteAddr: addr,
    read: p => r.read(p),
    write: p => w.write(p)
  };
}

test("handleKeepAliveConn should respond exclusively", async () => {
  const r = new Buffer();
  const w = new Buffer();
  await writeRequest(r, {
    method: "GET",
    url: "http://localhost/?q=1"
  });
  await writeRequest(r, {
    method: "GET",
    url: "http://localhost/?q=2"
  });
  await writeRequest(r, {
    method: "GET",
    url: "http://localhost/?q=3"
  });
  const d = deferred<void>();
  let latch = 3;
  handleKeepAliveConn(dummyConn(r, w), async req => {
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
  assertEquals(await resp1.body.text(), "resp:1");
  const resp2 = await readResponse(responseReader);
  assertEquals(await resp2.body.text(), "resp:2");
  const resp3 = await readResponse(responseReader);
  assertEquals(await resp3.body.text(), "resp:3");
});
