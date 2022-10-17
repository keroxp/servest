// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.

import {
  readResponse,
  setupBody,
  setupBodyInit,
  writeRequest,
  writeResponse,
} from "./serveio.ts";
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { StringReader } from "./vendor/https/deno.land/std/io/readers.ts";
import { decode, encode } from "./_util.ts";
import { Buffer } from "./vendor/https/deno.land/std/io/buffer.ts";
import { ServerResponse } from "./server.ts";
import { group } from "./_test_util.ts";
import { noopReader } from "./_readers.ts";

group("serveio", (t) => {
  t.test("serveioReadResponse", async function () {
    const f = await Deno.open("./fixtures/response.txt");
    const res = await readResponse(f);
    assertEquals(res.proto, "HTTP/1.1");
    assertEquals(res.status, 200);
    assertEquals(res.statusText, "OK");
    assertEquals(res.headers.get("content-type"), "text/plain");
    assertEquals(res.headers.get("content-length"), "69");
    assertEquals(
      await res.text(),
      "A secure JavaScript/TypeScript runtime built with V8, Rust, and Tokio",
    );
    f.close();
  });

  t.test("serveioReadResponseChunked", async function () {
    const f = await Deno.open("./fixtures/response_chunked.txt");
    const res = await readResponse(f);
    assertEquals(res.proto, "HTTP/1.1");
    assertEquals(res.status, 200);
    assertEquals(res.statusText, "OK");
    assertEquals(res.headers.get("content-type"), "text/plain");
    assertEquals(res.headers.get("transfer-encoding"), "chunked");
    assertEquals(res.headers.get("x-deno"), null);
    assertEquals(res.headers.get("x-node"), null);
    assertEquals(res.headers.get("trailer"), "x-deno, x-node");
    assertEquals(
      await res.text(),
      "A secure JavaScript/TypeScript runtime built with V8, Rust, and Tokio",
    );
    assertEquals(res.headers.get("x-deno"), "land");
    assertEquals(res.headers.get("x-node"), "js");
    assertEquals(res.headers.get("trailer"), null);
    f.close();
  });

  t.test("writeRequest", async () => {
    const buf = new Buffer();
    await writeRequest(buf, {
      url: "http://localhost",
      method: "POST",
      headers: new Headers({
        "content-type": "text/plain",
      }),
      body: "ok",
    });
    const exp = [
      "POST / HTTP/1.1",
      "content-length: 2",
      "content-type: text/plain",
      "date: ",
      "host: localhsot",
      "",
      "ok",
    ].join("\r\n");
    assertEquals(decode(buf.bytes()), exp);
  });

  t.test("writeRequestWithTrailer", async () => {
    const buf = new Buffer();
    await writeRequest(buf, {
      url: "http://localhost",
      method: "POST",
      headers: new Headers({
        "content-type": "text/plain",
        "transfer-encoding": "chunked",
        trailer: "deno,node",
      }),
      body: "ok",
      trailers: () =>
        new Headers({
          deno: "land",
          node: "js",
        }),
    });
    const exp = [
      "POST / HTTP/1.1",
      "content-length: 2",
      "content-type: text/plain",
      "date: ",
      "host: localhsot",
      "trailer: deno,node",
      "transfer-encoding: chunked",
      "",
      "ok",
    ].join("\r\n") + [
      "deno: land",
      "node: js",
      "",
    ].join("\r\n");
    assertEquals(decode(buf.bytes()), exp);
  });

  t.test("serveioWriteResponse", async function serveioWriteResponse() {
    const list: [
      ServerResponse["body"],
      string | null,
      string | undefined,
      string,
    ][] = [
      ["ok", "2", undefined, "text/plain; charset=UTF-8"],
      [encode("ok"), "2", "text/plain", "text/plain"],
      [new StringReader("ok"), null, undefined, "application/octet-stream"],
    ];
    for (const [body, len, contentType, expContentType] of list) {
      const buf = new Buffer();
      const headers = new Headers();
      if (contentType) {
        headers.set("content-type", "text/plain");
      }
      await writeResponse(buf, {
        status: 200,
        headers,
        body,
      });
      const res = await readResponse(buf);
      assertEquals(res.status, 200);
      assertEquals(res.headers.get("content-type"), expContentType);
      assertEquals(res.headers.get("content-length"), len);
      assertEquals(await res.text(), "ok");
    }
  });

  t.test("serveioWriteResponseWithoutHeaders", async function () {
    const buf = new Buffer();
    await writeResponse(buf, {
      status: 200,
      body: encode("ok"),
    });
    const res = await readResponse(buf);
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-length"), "2");
    assertEquals(await res.text(), "ok");
  });

  t.test("serveioWriteResponseWithTrailers", async function () {
    const buf = new Buffer();
    await writeResponse(buf, {
      status: 200,
      body: encode("ok"),
      headers: new Headers({
        trailer: "deno,node",
        "transfer-encoding": "chunked",
      }),
      trailers: () =>
        new Headers({
          deno: "land",
          node: "js",
        }),
    });
    const res = await readResponse(buf);
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("trailer"), "deno,node");
    assertEquals(res.headers.get("transfer-encoding"), "chunked");
    assertEquals(res.headers.get("deno"), null);
    assertEquals(res.headers.get("node"), null);
    assertEquals(await res.text(), "ok");
    assertEquals(res.headers.get("deno"), "land");
    assertEquals(res.headers.get("node"), "js");
  });
});
group("serveio/setupBody", (t) => {
  t.test("len,string,no-header", () => {
    const h = new Headers();
    const [r, l] = setupBody("ok", h);
    assertEquals(r instanceof Buffer, true);
    assertEquals(h.get("content-type"), "text/plain; charset=UTF-8");
    assertEquals(h.get("content-length"), "2");
    assertEquals(l, 2);
  });
  t.test("len,string,header", () => {
    const h = new Headers({ "content-type": "application/json" });
    const [r, l] = setupBody("[]", h);
    assertEquals(r instanceof Buffer, true);
    assertEquals(h.get("content-type"), "application/json");
    assertEquals(h.get("content-length"), "2");
    assertEquals(l, 2);
  });
  t.test("len,bin,no-header", () => {
    const h = new Headers();
    const [r, l] = setupBody(new Uint8Array([0, 1]), h);
    assertEquals(r instanceof Buffer, true);
    assertEquals(h.get("content-type"), "application/octet-stream");
    assertEquals(h.get("content-length"), "2");
    assertEquals(l, 2);
  });
  t.test("len,bin,header", () => {
    const ct = "text/plain";
    const h = new Headers({ "content-type": ct });
    const [r, l] = setupBody(new Uint8Array([0, 1]), h);
    assertEquals(r instanceof Buffer, true);
    assertEquals(h.get("content-type"), ct);
    assertEquals(h.get("content-length"), "2");
    assertEquals(l, 2);
  });
  t.test("len,reader,no-header", () => {
    const h = new Headers();
    const body = new Buffer(new Uint8Array([0, 1]));
    const [r, l] = setupBody(body, h);
    assertEquals(r, body);
    assertEquals(h.get("content-type"), "application/octet-stream");
    assertEquals(h.has("content-length"), false);
    assertEquals(h.get("transfer-encoding"), "chunked");
    assertEquals(l, undefined);
  });
  t.test("len,reader,header", () => {
    const ct = "text/plain";
    const h = new Headers({ "content-type": ct });
    const body = new Buffer(new Uint8Array([0, 1]));
    const [r, l] = setupBody(body, h);
    assertEquals(r, body);
    assertEquals(h.get("content-type"), ct);
    assertEquals(h.has("content-length"), false);
    assertEquals(l, undefined);
    assertEquals(h.get("transfer-encoding"), "chunked");
  });
  t.test("len,reader,header,cl", () => {
    const ct = "text/plain";
    const h = new Headers({ "content-type": ct, "content-length": "2" });
    const body = new Buffer(new Uint8Array([0, 1]));
    const [r, l] = setupBody(body, h);
    assertEquals(r, body);
    assertEquals(h.get("content-type"), ct);
    assertEquals(h.get("content-length"), "2");
    assertEquals(l, 2);
    assertEquals(h.has("transfer-encoding"), false);
  });
  // chunked
  t.test("chunked,string,no-header", () => {
    const h = new Headers({ "transfer-encoding": "chunked" });
    const [r, l] = setupBody("ok", h);
    assertEquals(r instanceof Buffer, true);
    assertEquals(h.get("content-type"), "text/plain; charset=UTF-8");
    assertEquals(h.has("content-length"), false);
    assertEquals(h.get("transfer-encoding"), "chunked");
    assertEquals(l, undefined);
  });
  t.test("chunked,string,header", () => {
    const h = new Headers({
      "content-type": "application/json",
      "transfer-encoding": "chunked",
    });
    const [r, l] = setupBody("[]", h);
    assertEquals(r instanceof Buffer, true);
    assertEquals(h.get("content-type"), "application/json");
    assertEquals(h.get("transfer-encoding"), "chunked");
    assertEquals(h.has("content-length"), false);
    assertEquals(l, undefined);
  });
  t.test("chunked,bin,no-header", () => {
    const h = new Headers({ "transfer-encoding": "chunked" });
    const [r, l] = setupBody(new Uint8Array([0, 1]), h);
    assertEquals(r instanceof Buffer, true);
    assertEquals(h.get("content-type"), "application/octet-stream");
    assertEquals(h.get("transfer-encoding"), "chunked");
    assertEquals(h.has("content-length"), false);
    assertEquals(l, undefined);
  });
  t.test("chunked,bin,header", () => {
    const ct = "text/plain";
    const h = new Headers({
      "transfer-encoding": "chunked",
      "content-type": ct,
    });
    const [r, l] = setupBody(new Uint8Array([0, 1]), h);
    assertEquals(r instanceof Buffer, true);
    assertEquals(h.get("content-type"), ct);
    assertEquals(h.has("content-length"), false);
    assertEquals(h.get("transfer-encoding"), "chunked");
    assertEquals(l, undefined);
  });
  t.test("chunked,reader,no-header", () => {
    const h = new Headers({ "transfer-encoding": "chunked" });
    const body = new Buffer(new Uint8Array([0, 1]));
    const [r, l] = setupBody(body, h);
    assertEquals(r, body);
    assertEquals(h.get("content-type"), "application/octet-stream");
    assertEquals(h.has("content-length"), false);
    assertEquals(h.get("transfer-encoding"), "chunked");
    assertEquals(l, undefined);
  });
  t.test("chunked,reader,header", () => {
    const ct = "text/plain";
    const h = new Headers({
      "transfer-encoding": "chunked",
      "content-type": ct,
    });
    const body = new Buffer(new Uint8Array([0, 1]));
    const [r, l] = setupBody(body, h);
    assertEquals(r, body);
    assertEquals(h.get("content-type"), ct);
    assertEquals(h.has("content-length"), false);
    assertEquals(h.get("transfer-encoding"), "chunked");
    assertEquals(l, undefined);
  });
});

group("serveio/setupBodyInit", ({ test }) => {
  test("string", () => {
    const [body, ct] = setupBodyInit("");
    assertEquals(body, "");
    assertEquals(ct, "text/plain; charset=UTF-8");
  });
  test("Uint8Array", () => {
    const arr = new Uint8Array();
    const [body, ct] = setupBodyInit(arr);
    assertEquals(body, arr);
    assertEquals(ct, "application/octet-stream");
  });
  test("Uint8Array", () => {
    const stream = new ReadableStream();
    const [body, ct] = setupBodyInit(stream);
    assertEquals(body, stream);
    assertEquals(ct, "application/octet-stream");
  });
  test("Reader", () => {
    const reader = noopReader();
    const [body, ct] = setupBodyInit(reader);
    assertEquals(body instanceof ReadableStream, true);
    assertEquals(ct, "application/octet-stream");
  });
});
