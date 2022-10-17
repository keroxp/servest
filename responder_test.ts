// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { createResponder } from "./responder.ts";
import {
  assert,
  assertEquals,
  assertThrowsAsync,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { StringReader } from "./vendor/https/deno.land/std/io/readers.ts";
import { readResponse, writeResponse } from "./serveio.ts";
import { Buffer } from "./vendor/https/deno.land/std/io/buffer.ts";

Deno.test("responder", async (t) => {
  function _createResponder(w: Deno.Writer) {
    return createResponder((resp) => writeResponse(w, resp));
  }
  await t.step("basic", async function () {
    const w = new Buffer();
    const res = _createResponder(w);
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

  await t.step(
    "respond() should throw if already responded",
    async function () {
      const w = new Buffer();
      const res = _createResponder(w);
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
    },
  );

  await t.step("sendFile() basic", async function () {
    const w = new Buffer();
    const res = _createResponder(w);
    await res.sendFile("./fixtures/sample.txt");
    const resp = await readResponse(w);
    assertEquals(resp.status, 200);
    assertEquals(resp.headers.get("content-type"), "text/plain");
    assertEquals(await resp.text(), "sample");
  });

  await t.step("sendFile() should throw if file not found", async () => {
    const w = new Buffer();
    const res = _createResponder(w);
    await assertThrowsAsync(
      () => res.sendFile("./fixtures/not-found"),
      Deno.errors.NotFound,
    );
  });

  await t.step("sendFile() with attachment", async () => {
    const w = new Buffer();
    const res = _createResponder(w);
    await res.sendFile("./fixtures/sample.txt", {
      contentDisposition: "inline",
    });
    const resp = await readResponse(w);
    assertEquals(resp.status, 200);
    assertEquals(resp.headers.get("content-disposition"), "inline");
    assertEquals(await resp.text(), "sample");
  });

  await t.step("sendFile() with attachment", async () => {
    const w = new Buffer();
    const res = _createResponder(w);
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

  await t.step("redirect() should set Location header", async () => {
    const w = new Buffer();
    const res = _createResponder(w);
    await res.redirect("/index.html");
    const { status, headers } = await readResponse(w);
    assertEquals(status, 302);
    assertEquals(headers.get("location"), "/index.html");
  });

  await t.step("redirect() should use partial body for response", async () => {
    const w = new Buffer();
    const res = _createResponder(w);
    await res.redirect("/", {
      status: 303,
      headers: new Headers({ "content-type": "text/plain" }),
      body: "Redirecting...",
    });
    const resp = await readResponse(w);
    assertEquals(resp.status, 303);
    assertEquals(resp.headers.get("content-type"), "text/plain");
    assertEquals(await resp.text(), "Redirecting...");
  });

  await t.step(
    "resirect() should throw error if status code is not in 300~399",
    async () => {
      const w = new Buffer();
      const res = _createResponder(w);
      await assertThrowsAsync(
        async () => {
          await res.redirect("/", { status: 200 });
        },
        Error,
        "redirection status code",
      );
    },
  );

  await t.step("markResponded()", async () => {
    const w = new Buffer();
    const res = _createResponder(w);
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
