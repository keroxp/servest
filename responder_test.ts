// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { runIfMain, test } from "./vendor/https/deno.land/std/testing/mod.ts";
import { createResponder } from "./responder.ts";
import {
  assert,
  assertEquals,
  assertThrowsAsync
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { StringReader } from "./vendor/https/deno.land/std/io/readers.ts";
import { readResponse } from "./serveio.ts";
import { StringWriter } from "./vendor/https/deno.land/std/io/writers.ts";
import Buffer = Deno.Buffer;
import copy = Deno.copy;
import Reader = Deno.Reader;

test(async function httpServerResponder() {
  const w = new Buffer();
  const res = createResponder(w);
  assert(!res.isResponded());
  await res.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/plain"
    }),
    body: new StringReader("ok")
  });
  assert(res.isResponded());
  const resp = await readResponse(w);
  assertEquals(resp.status, 200);
  assertEquals(resp.headers.get("content-type"), "text/plain");
  const sw = new StringWriter();
  await copy(sw, resp.body as Reader);
  assertEquals(sw.toString(), "ok");
});

test(async function httpServerResponderShouldThrow() {
  const w = new Buffer();
  {
    const res = createResponder(w);
    await res.respond({
      status: 200,
      headers: new Headers(),
      body: null
    });
    await assertThrowsAsync(
      async () =>
        res.respond({
          status: 200,
          headers: new Headers(),
          body: null
        }),
      Error,
      "responded"
    );
  }
});
runIfMain(import.meta);
