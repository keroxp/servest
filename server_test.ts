// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { runIfMain, test } from "https://deno.land/std@v0.3.2/testing/mod.ts";
import { defer } from "./promises.ts";
import { serve } from "./server.ts";
import { StringReader } from "https://deno.land/std@v0.3.2/io/readers.ts";
import { StringWriter } from "https://deno.land/std@v0.3.2/io/writers.ts";
import {
  assertEquals,
  assertThrowsAsync
} from "https://deno.land/std@v0.3.2/testing/asserts.ts";
import { readResponse, writeRequest } from "./serveio.ts";
import { createResponder } from "./responder.ts";
import { readUntilEof } from "./readers.ts";
import { encode } from "https://deno.land/std@v0.3.2/strings/strings.ts";
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
  try {
    const conn = await Deno.dial("tcp", `127.0.0.1:${port}`);
    const req = {
      url: `http://127.0.0.1:${port}/`,
      method: "POST",
      headers: new Headers({
        host: "deno.land"
      }),
      body: encode("hello")
    };
    await writeRequest(conn, req);
    const { status, body } = await readResponse(conn);
    await readUntilEof(body);
    assertEquals(200, status);
    await assertThrowsAsync(async () => {
      await writeRequest(conn, req);
      await readResponse(conn);
    });
  } finally {
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
  try {
    const conn = await Deno.dial("tcp", `127.0.0.1:${port}`);
    const req = {
      url: `http://127.0.0.1:${port}/`,
      method: "POST",
      headers: new Headers({
        host: "deno.land",
        "keep-alive": "max=0, timeout=1000"
      }),
      body: encode("hello")
    };
    await writeRequest(conn, req);
    const { status, body } = await readResponse(conn);
    await readUntilEof(body);
    assertEquals(200, status);
    await assertThrowsAsync(async () => {
      await writeRequest(conn, req);
      await readResponse(conn);
    });
  } finally {
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
  try {
    const conn = await Deno.dial("tcp", `127.0.0.1:${port}`);
    const req = {
      url: `http://127.0.0.1:${port}/`,
      method: "POST",
      headers: new Headers({
        host: "deno.land",
        "connection": "close",
      }),
      body: encode("hello")
    };
    await writeRequest(conn, req);
    const { status, body } = await readResponse(conn);
    await readUntilEof(body);
    assertEquals(200, status);
    await assertThrowsAsync(async () => {
      await writeRequest(conn, req);
      await readResponse(conn);
    });
  } finally {
    d.resolve();
  }
});

runIfMain(import.meta);
