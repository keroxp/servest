// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { runIfMain, test } from "https://deno.land/std@v0.3.1/testing/mod.ts";
import { defer } from "./deferred.ts";
import { serve, writeResponse } from "./server.ts";
import { StringReader } from "https://deno.land/std@v0.3.1/io/readers.ts";
import { StringWriter } from "https://deno.land/std@v0.3.1/io/writers.ts";
import { assertEquals } from "https://deno.land/std@v0.3.1/testing/asserts.ts";
import copy = Deno.copy;
const d = defer();
(async function() {
  for await (const req of serve("0.0.0.0:8899", d.promise)) {
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
test(async function server() {
  const { status, headers, body } = await fetch("http://127.0.0.1:8899");
  assertEquals(headers.get("content-length"), "5");
  assertEquals(status, 200);
  assertEquals(headers.get("content-type"), "text/plain");
  const dest = new StringWriter();
  await copy(dest, body);
  assertEquals(dest.toString(), "hello");
});

runIfMain(import.meta).finally(() => d.resolve());
