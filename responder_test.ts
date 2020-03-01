// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
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
import { it } from "./test_util.ts";

it("responder", t => {
  t.run("httpServerResponder", async function() {
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

  t.run("httpServerResponderShouldThrow", async function() {
    const w = new Buffer();
    {
      const res = createResponder(w);
      await res.respond({
        status: 200,
        headers: new Headers()
      });
      await assertThrowsAsync(
        async () =>
          res.respond({
            status: 200,
            headers: new Headers()
          }),
        Error,
        "responded"
      );
    }
  });

  t.run("responder redirect should set Location header", async () => {
    const w = new Buffer();
    const res = createResponder(w);
    await res.redirect("/index.html");
    const { status, headers } = await readResponse(w);
    assertEquals(status, 302);
    assertEquals(headers.get("location"), "/index.html");
  });
});
