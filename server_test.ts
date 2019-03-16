// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import {runIfMain, test} from "https://deno.land/std@v0.3.1/testing/mod.ts";
import {defer} from "./deferred.ts";
import {serve, writeRequest, writeResponse} from "./server.ts";
import {StringReader} from "https://deno.land/std@v0.3.1/io/readers.ts";
import {StringWriter} from "https://deno.land/std@v0.3.1/io/writers.ts";
import {assertEquals, assertThrowsAsync} from "https://deno.land/std@v0.3.1/testing/asserts.ts";
import copy = Deno.copy;
import {createResponder} from "./responder.ts";
import {encode} from "https://deno.land/std@v0.3.1/strings/strings.ts";
import {request} from "https://denopkg.com/keroxp/deno-request@v0.2.1/request.ts";
import ReadResult = Deno.ReadResult;
import {wait} from "./util.ts";

test(async function server() {
  const d = defer();
  (async function () {
    for await (const req of serve("0.0.0.0:8899", {cancel: d.promise})) {
      await writeResponse(req.bufWriter, {
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
    const {status, headers, body} = await fetch("http://127.0.0.1:8899");
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
  const d = defer<ReadResult>();
  (async () => {
    for await (const req of serve("0.0.0.0:8888", {
      cancel: d.promise,
      keepAliveTimeout: 1
    })) {
      await createResponder(req.bufWriter).respond({
        status: 200,
        headers: new Headers(),
        body: encode("ok")
      });
    }
  })();
  try {
    const {status, conn} = await request({
      url: "http://127.0.0.1:8888",
      method: "GET",
    });
    assertEquals(200, status);
    await wait(2000);
    const {nread, eof} = await conn.read(new Uint8Array(10));
    assertEquals(nread, 0);
    assertEquals(eof, true);
  } finally {
    d.resolve()
  }
});

runIfMain(import.meta);
