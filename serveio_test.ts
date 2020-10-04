// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.

import {
  parseKeepAlive,
  readRequest,
  readResponse,
  setupBody,
  writeRequest,
  writeResponse,
} from "./serveio.ts";
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { StringReader } from "./vendor/https/deno.land/std/io/readers.ts";
import { encode } from "./vendor/https/deno.land/std/encoding/utf8.ts";
import Buffer = Deno.Buffer;
import copy = Deno.copy;
import { ServerResponse } from "./server.ts";
import { group } from "./_test_util.ts";

group("serveio", (t) => {
  t.test("serveioReadRequestGet", async function serveioReadRequestGet() {
    const f = await Deno.open("./fixtures/request_get.txt");
    const req = await readRequest(f);
    assertEquals(req.method, "GET");
    assertEquals(req.url, "/index.html?deno=land&msg=gogo");
    assertEquals(req.path, "/index.html");
    assertEquals(req.query.get("deno"), "land");
    assertEquals(req.query.get("msg"), "gogo");
    assertEquals(req.proto, "HTTP/1.1");
    assertEquals(req.headers.get("host"), "deno.land");
    assertEquals(req.headers.get("content-type"), "text/plain");
    const eof = await req.body.read(new Uint8Array());
    assertEquals(eof, null);
    f.close();
  });

  t.test(
    "serveioReadRequestGetCapital",
    async function serveioReadRequestGetCapital() {
      const f = await Deno.open("./fixtures/request_get_capital.txt");
      const req = await readRequest(f);
      assertEquals(req.method, "GET");
      assertEquals(req.url, "/About/Index.html?deno=land&msg=gogo");
      assertEquals(req.query.get("deno"), "land");
      assertEquals(req.query.get("msg"), "gogo");
      assertEquals(req.proto, "HTTP/1.1");
      assertEquals(req.headers.get("host"), "deno.land");
      assertEquals(req.headers.get("content-type"), "text/plain");
      const eof = await req.body.read(new Uint8Array());
      assertEquals(eof, null);
      f.close();
    },
  );

  t.test(
    "serveioReadRequestEncoded",
    async function serveioReadRequestEncoded() {
      const f = await Deno.open("./fixtures/request_get_encoded.txt");
      const req = await readRequest(f);
      assertEquals(req.method, "GET");
      assertEquals(
        req.url,
        "/%E3%81%A7%E3%81%AE%E3%81%8F%E3%81%AB?deno=%F0%9F%A6%95",
      );
      assertEquals(req.proto, "HTTP/1.1");
      assertEquals(req.path, "/%E3%81%A7%E3%81%AE%E3%81%8F%E3%81%AB");
      assertEquals(req.query.get("deno"), "🦕");
      assertEquals(req.headers.get("host"), "deno.land");
      assertEquals(req.headers.get("content-type"), "text/plain");
      const eof = await req.body.read(new Uint8Array());
      assertEquals(eof, null);
      f.close();
    },
  );

  t.test("serveioReadRequestPost", async function serveioReadRequestPost() {
    const f = await Deno.open("./fixtures/request_post.txt");
    const req = await readRequest(f);
    assertEquals(req.method, "POST");
    assertEquals(req.url, "/index.html");
    assertEquals(req.path, "/index.html");
    assertEquals(req.proto, "HTTP/1.1");
    assertEquals(req.headers.get("host"), "deno.land");
    assertEquals(req.headers.get("content-type"), "text/plain");
    assertEquals(req.headers.get("content-length"), "69");
    assertEquals(
      await req.text(),
      "A secure JavaScript/TypeScript runtime built with V8, Rust, and Tokio",
    );
    f.close();
  });

  t.test(
    "serveioReadRequestPostChunked",
    async function serveioReadRequestPostChunked() {
      const f = await Deno.open("./fixtures/request_post_chunked.txt");
      const req = await readRequest(f);
      assertEquals(req.method, "POST");
      assertEquals(req.url, "/index.html");
      assertEquals(req.proto, "HTTP/1.1");
      assertEquals(req.headers.get("host"), "deno.land");
      assertEquals(req.headers.get("content-type"), "text/plain");
      assertEquals(req.headers.get("transfer-encoding"), "chunked");
      assertEquals(
        await req.text(),
        "A secure JavaScript/TypeScript runtime built with V8, Rust, and Tokio",
      );
      f.close();
    },
  );

  t.test(
    "serveioReadRequestPostChunkedWithTrailers",
    async function serveioReadRequestPostChunkedWithTrailers() {
      const f = await Deno.open(
        "./fixtures/request_post_chunked_trailers.txt",
      );
      const req = await readRequest(f);
      assertEquals(req.method, "POST");
      assertEquals(req.url, "/index.html");
      assertEquals(req.proto, "HTTP/1.1");
      assertEquals(req.headers.get("host"), "deno.land");
      assertEquals(req.headers.get("content-type"), "text/plain");
      assertEquals(req.headers.get("transfer-encoding"), "chunked");
      assertEquals(req.headers.get("x-deno"), null);
      assertEquals(req.headers.get("x-node"), null);
      assertEquals(req.headers.get("trailer"), "x-deno, x-node");
      assertEquals(
        await req.text(),
        "A secure JavaScript/TypeScript runtime built with V8, Rust, and Tokio",
      );
      assertEquals(req.headers.get("x-deno"), "land");
      assertEquals(req.headers.get("x-node"), "js");
      assertEquals(req.headers.get("trailer"), null);
      f.close();
    },
  );

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
    const req = await readRequest(buf);
    assertEquals(req.url, "/");
    assertEquals(req.headers.get("content-type"), "text/plain");
    assertEquals(req.headers.get("content-length"), "2");
    assertEquals(await req.text(), "ok");
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
    const req = await readRequest(buf);
    assertEquals(req.url, "/");
    assertEquals(req.headers.get("content-type"), "text/plain");
    assertEquals(req.headers.has("content-length"), false);
    assertEquals(req.headers.get("deno"), null);
    assertEquals(req.headers.get("node"), null);
    assertEquals(req.headers.get("trailer"), "deno,node");
    assertEquals(await req.text(), "ok");
    assertEquals(req.headers.get("deno"), "land");
    assertEquals(req.headers.get("node"), "js");
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

group("serveio/keep-alive", (t) => {
  t.test("serveioParseKeepAlive", function () {
    const ka = parseKeepAlive(
      new Headers({
        "keep-alive": "timeout=5, max=100",
      }),
    );
    assertEquals(ka.timeout, 5);
    assertEquals(ka.max, 100);
  });
});
