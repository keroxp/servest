// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { createResponder } from "./responder.ts";
import {
  assert,
  assertEquals,
  assertThrowsAsync,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { StringReader } from "./vendor/https/deno.land/std/io/readers.ts";
import { readResponse } from "./serveio.ts";
import { group } from "./test_util.ts";

group("responder", (t) => {
  t.test("basic", async function () {
    const w = new Deno.Buffer();
    const res = createResponder(w);
    assert(!res.isResponded());
    await res.respond({
      status: 200,
      headers: new Headers({
        "content-type": "text/plain",
      }),
      body: new StringReader("ok"),
    });
    assert(res.isResponded());
    const resp = await readResponse(w);
    assertEquals(resp.status, 200);
    assertEquals(resp.headers.get("content-type"), "text/plain");
    assertEquals(await resp.text(), "ok");
  });

  t.test("respond() should throw if already responded", async function () {
    const w = new Deno.Buffer();
    const res = createResponder(w);
    await res.respond({
      status: 200,
      headers: new Headers(),
    });
    await assertThrowsAsync(
      async () =>
        res.respond({
          status: 200,
          headers: new Headers(),
        }),
      Error,
      "responded",
    );
  });

  t.test("sendFile() basic", async function () {
    const w = new Deno.Buffer();
    const res = createResponder(w);
    await res.sendFile("./fixtures/sample.txt");
    const resp = await readResponse(w);
    assertEquals(resp.status, 200);
    assertEquals(resp.headers.get("content-type"), "text/plain");
    assertEquals(await resp.text(), "sample");
  });

  t.test("sendFile() should throw if file not found", async () => {
    const w = new Deno.Buffer();
    const res = createResponder(w);
    await assertThrowsAsync(
      () => res.sendFile("./fixtures/not-found"),
      Deno.errors.NotFound,
    );
  });

  t.test("sendFile() with attachment", async () => {
    const w = new Deno.Buffer();
    const res = createResponder(w);
    await res.sendFile("./fixtures/sample.txt", {
      contentDisposition: "inline",
    });
    const resp = await readResponse(w);
    assertEquals(resp.status, 200);
    assertEquals(resp.headers.get("content-disposition"), "inline");
    assertEquals(await resp.text(), "sample");
  });

  t.test("sendFile() with attachment", async () => {
    const w = new Deno.Buffer();
    const res = createResponder(w);
    await res.sendFile("./fixtures/sample.txt", {
      contentDisposition: "attachment",
    });
    const resp = await readResponse(w);
    assertEquals(resp.status, 200);
    assertEquals(
      resp.headers.get("content-disposition"),
      'attachment; filename="sample.txt"',
    );
    assertEquals(await resp.text(), "sample");
  });

  t.test("responder redirect should set Location header", async () => {
    const w = new Deno.Buffer();
    const res = createResponder(w);
    await res.redirect("/index.html");
    const { status, headers } = await readResponse(w);
    assertEquals(status, 302);
    assertEquals(headers.get("location"), "/index.html");
  });

  t.test("markResponded()", async () => {
    const w = new Deno.Buffer();
    const res = createResponder(w);
    res.markAsResponded(200);
    assertEquals(res.isResponded(), true);
    assertEquals(res.respondedStatus(), 200);
    await assertThrowsAsync(
      () => res.respond({ status: 404, body: "404" }),
      Error,
      "already",
    );
  });
});
