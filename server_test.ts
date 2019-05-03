// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { runIfMain, test } from "https://deno.land/std@v0.3.4/testing/mod.ts";
import { defer } from "./promises.ts";
import { serve } from "./server.ts";
import { StringReader } from "https://deno.land/std@v0.3.4/io/readers.ts";
import { StringWriter } from "https://deno.land/std@v0.3.4/io/writers.ts";
import {
  assertEquals,
  assertThrowsAsync
} from "https://deno.land/std@v0.3.4/testing/asserts.ts";
import { createResponder } from "./responder.ts";
import { encode } from "https://deno.land/std@v0.3.4/strings/strings.ts";
import { createAgent } from "./agent.ts";
import copy = Deno.copy;

let port = 8880;
test(async function server() {
  const d = defer();
  (async function() {
    for await (const req of serve(`0.0.0.0:${port}`, { cancel: d.promise })) {
      await req.respond({
        status: 200,
        headers: new Headers({
          "Content-Type": "text/plain",
          "Content-Length": "5"
        }),
        body: new StringReader("hello")
      });
    }
  })();
  try {
    const { status, headers, body } = await fetch(`http://127.0.0.1:${port}`);
    assertEquals(headers.get("content-length"), "5");
    assertEquals(status, 200);
    assertEquals(headers.get("content-type"), "text/plain");
    const dest = new StringWriter();
    await copy(dest, body);
    assertEquals(dest.toString(), "hello");
  } finally {
    d.resolve();
  }
});

test(async function serverKeepAliveTimeout() {
  port++;
  const d = defer();
  (async () => {
    for await (const req of serve(`0.0.0.0:${port}`, {
      cancel: d.promise,
      keepAliveTimeout: 0
    })) {
      await createResponder(req.bufWriter).respond({
        status: 200,
        headers: new Headers(),
        body: encode("ok")
      });
    }
  })();
  const agent = createAgent(`http://127.0.0.1:${port}`);
  try {
    const req = {
      path: "/",
      method: "POST",
      headers: new Headers({
        host: "deno.land"
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
    d.resolve();
  }
});

test(async function serverKeepAliveTimeoutMax() {
  const d = defer();
  port++;
  (async () => {
    for await (const req of serve(`0.0.0.0:${port}`, {
      cancel: d.promise
    })) {
      await createResponder(req.bufWriter).respond({
        status: 200,
        headers: new Headers(),
        body: encode("ok")
      });
    }
  })();
  const agent = createAgent(`http://127.0.0.1:${port}`);
  try {
    const req = {
      path: "/",
      method: "POST",
      headers: new Headers({
        host: "deno.land",
        "keep-alive": "max=0, timeout=1000"
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
    d.resolve();
  }
});

test(async function serverConnectionClose() {
  const d = defer();
  port++;
  (async () => {
    for await (const req of serve(`0.0.0.0:${port}`, {
      cancel: d.promise
    })) {
      await createResponder(req.bufWriter).respond({
        status: 200,
        headers: new Headers(),
        body: encode("ok")
      });
    }
  })();
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
    d.resolve();
  }
});

runIfMain(import.meta);
