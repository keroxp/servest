// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import {
  runIfMain,
  setFilter,
  test
} from "./vendor/https/deno.land/std/testing/mod.ts";
import { handleKeepAliveConn, listenAndServe } from "./server.ts";
import { StringReader } from "./vendor/https/deno.land/std/io/readers.ts";
import { StringWriter } from "./vendor/https/deno.land/std/io/writers.ts";
import {
  assertEquals,
  assertThrowsAsync
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { encode } from "./vendor/https/deno.land/std/strings/encode.ts";
import { createAgent } from "./agent.ts";
import { it } from "./test_util.ts";

let port = 8880;

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

it("handleKeepAliveConn", t => {
  t.beforeAfterAll(() => {
    port++;
    const l = listenAndServe({ port }, async req => {
      const url = new URL(req.url, "http://dummy");
      const i = url.searchParams.get("q")!;
      req.respond({ status: 200, body: "resp:" + i });
    });
    return () => l.close();
  });
  t.run("should respond exclusively", async () => {
    const [resp1, resp2, resp3] = await Promise.all([
      fetch("http://localhost:" + port + "/?q=1"),
      fetch("http://localhost:" + port + "/?q=2"),
      fetch("http://localhost:" + port + "/?q=3")
    ]);
    assertEquals(await resp1.body.text(), "resp:1");
    assertEquals(await resp2.body.text(), "resp:2");
    assertEquals(await resp3.body.text(), "resp:3");
  });
});

runIfMain(import.meta);
