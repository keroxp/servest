// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { runIfMain, test } from "https://deno.land/std@v0.15.0/testing/mod.ts";
import { defer } from "./promises.ts";
import { listenAndServe } from "./server.ts";
import { StringReader } from "https://deno.land/std@v0.15.0/io/readers.ts";
import { StringWriter } from "https://deno.land/std@v0.15.0/io/writers.ts";
import {
  assertEquals,
  assertThrowsAsync
} from "https://deno.land/std@v0.15.0/testing/asserts.ts";
import { encode } from "https://deno.land/std@v0.15.0/strings/encode.ts";
import { createAgent } from "./agent.ts";
import copy = Deno.copy;
import { promiseTimeout } from "./test_util.ts";

let port = 8880;
test(async function server() {
  const d = defer();
  listenAndServe(
    `0.0.0.0:${port}`,
    async req => {
      await req.respond({
        status: 200,
        headers: new Headers({
          "Content-Type": "text/plain",
          "Content-Length": "5"
        }),
        body: new StringReader("hello")
      });
    },
    { cancel: d.promise }
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
    await copy(dest, body);
    assertEquals(dest.toString(), "hello");
  } finally {
    agent.conn.close();
    await promiseTimeout(100);
    d.resolve();
  }
});

test(async function serverKeepAliveTimeout() {
  port++;
  const d = defer();
  listenAndServe(
    `0.0.0.0:${port}`,
    async req => {
      await req.respond({
        status: 200,
        headers: new Headers(),
        body: encode("ok")
      });
    },
    {
      cancel: d.promise,
      keepAliveTimeout: 0
    }
  );
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
  listenAndServe(
    `0.0.0.0:${port}`,
    async req => {
      await req.respond({
        status: 200,
        headers: new Headers(),
        body: encode("ok")
      });
    },
    { cancel: d.promise }
  );
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
  listenAndServe(
    `0.0.0.0:${port}`,
    async req => {
      await req.respond({
        status: 200,
        headers: new Headers(),
        body: encode("ok")
      });
    },
    { cancel: d.promise }
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
    d.resolve();
  }
});

runIfMain(import.meta);
