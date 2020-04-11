// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.

import {
  parseKeepAlive,
  readRequest,
  readResponse,
  setupBody,
  writeRequest,
  writeResponse,
} from "./serveio.ts";
import {
  assert,
  assertEquals,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { StringReader } from "./vendor/https/deno.land/std/io/readers.ts";
import { encode } from "./vendor/https/deno.land/std/encoding/utf8.ts";
import Reader = Deno.Reader;
import Buffer = Deno.Buffer;
import copy = Deno.copy;
import { ServerResponse } from "./server.ts";
import { readString } from "./util.ts";
import { it } from "./test_util.ts";

it("serveio", (t) => {
  t.run("serveioReadRequestGet", async function serveioReadRequestGet() {
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
    assert(req.body === void 0);
    assert(req.trailers === void 0);
    f.close();
  });

  t.run(
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
      assert(req.body === void 0);
      assert(req.trailers === void 0);
      f.close();
    },
  );

  t.run(
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
      assert(req.body === void 0);
      assert(req.trailers === void 0);
      f.close();
    },
  );

  t.run("serveioReadRequestPost", async function serveioReadRequestPost() {
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
      await readString(req.body!),
      "A secure JavaScript/TypeScript runtime built with V8, Rust, and Tokio",
    );
    assert(req.trailers === void 0);
    f.close();
  });

  t.run(
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
        await readString(req.body!),
        "A secure JavaScript/TypeScript runtime built with V8, Rust, and Tokio",
      );
      assertEquals(req.trailers, void 0);
      f.close();
    },
  );

  t.run(
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
      assertEquals(
        await readString(req.body!),
        "A secure JavaScript/TypeScript runtime built with V8, Rust, and Tokio",
      );
      assertEquals(req.trailers, void 0);
      assertEquals(typeof req.finalize, "function");
      await req.finalize();
      assertEquals(req.trailers?.constructor, Headers);
      assertEquals(req.trailers?.get("x-deno"), "land");
      assertEquals(req.trailers?.get("x-node"), "js");
      f.close();
    },
  );

  t.run("serveioReadResponse", async function () {
    const f = await Deno.open("./fixtures/response.txt");
    const res = await readResponse(f);
    assertEquals(res.proto, "HTTP/1.1");
    assertEquals(res.status, 200);
    assertEquals(res.statusText, "OK");
    assertEquals(res.headers.get("content-type"), "text/plain");
    assertEquals(res.headers.get("content-length"), "69");
    assertEquals(
      await readString(res.body),
      "A secure JavaScript/TypeScript runtime built with V8, Rust, and Tokio",
    );
    assertEquals(res.trailers, void 0);
    assertEquals(typeof res.finalize, "function");
    f.close();
  });

  t.run("serveioReadResponseChunked", async function () {
    const f = await Deno.open("./fixtures/response_chunked.txt");
    const res = await readResponse(f);
    assertEquals(res.proto, "HTTP/1.1");
    assertEquals(res.status, 200);
    assertEquals(res.statusText, "OK");
    assertEquals(res.headers.get("content-type"), "text/plain");
    assertEquals(res.headers.get("transfer-encoding"), "chunked");
    assertEquals(
      await readString(res.body),
      "A secure JavaScript/TypeScript runtime built with V8, Rust, and Tokio",
    );
    assertEquals(res.trailers, void 0);
    await res.finalize();
    assertEquals(res.trailers?.get("x-deno"), "land");
    assertEquals(res.trailers?.get("x-node"), "js");
    assert(typeof res.finalize === "function");
    f.close();
  });

  t.run("writeRequest", async () => {
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
    assertEquals(await req.body?.text(), "ok");
  });

  t.run("writeRequestWithTrailer", async () => {
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
    assertEquals(await req.body?.text(), "ok");
    assertEquals(req.trailers, undefined);
    await req.finalize();
    assertEquals(req.trailers?.get("deno"), "land");
    assertEquals(req.trailers?.get("node"), "js");
  });

  t.run("serveioWriteResponse", async function serveioWriteResponse() {
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
      const resBody = new Buffer();
      await copy(resBody, res.body);
      assertEquals(resBody.toString(), "ok");
    }
  });

  t.run("serveioWriteResponseWithoutHeaders", async function () {
    const buf = new Buffer();
    await writeResponse(buf, {
      status: 200,
      body: encode("ok"),
    });
    const res = await readResponse(buf);
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-length"), "2");
    const resBody = new Buffer();
    await copy(resBody, res.body);
    assertEquals(resBody.toString(), "ok");
  });

  t.run("serveioWriteResponseWithTrailers", async function () {
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
    const resBody = new Buffer();
    await copy(resBody, res.body);
    assertEquals(resBody.toString(), "ok");
    assertEquals(res.trailers, undefined);
    await res.finalize();
    assertEquals(res.trailers?.get("deno"), "land");
    assertEquals(res.trailers?.get("node"), "js");
  });
});
it("serveio/setupBody", (t) => {
  t.run("len,string,no-header", () => {
    const h = new Headers();
    const [r, l] = setupBody("ok", h);
    assertEquals(r instanceof Buffer, true);
    assertEquals(h.get("content-type"), "text/plain; charset=UTF-8");
    assertEquals(h.get("content-length"), "2");
    assertEquals(l, 2);
  });
  t.run("len,string,header", () => {
    const h = new Headers({ "content-type": "application/json" });
    const [r, l] = setupBody("[]", h);
    assertEquals(r instanceof Buffer, true);
    assertEquals(h.get("content-type"), "application/json");
    assertEquals(h.get("content-length"), "2");
    assertEquals(l, 2);
  });
  t.run("len,bin,no-header", () => {
    const h = new Headers();
    const [r, l] = setupBody(new Uint8Array([0, 1]), h);
    assertEquals(r instanceof Buffer, true);
    assertEquals(h.get("content-type"), "application/octet-stream");
    assertEquals(h.get("content-length"), "2");
    assertEquals(l, 2);
  });
  t.run("len,bin,header", () => {
    const ct = "text/plain";
    const h = new Headers({ "content-type": ct });
    const [r, l] = setupBody(new Uint8Array([0, 1]), h);
    assertEquals(r instanceof Buffer, true);
    assertEquals(h.get("content-type"), ct);
    assertEquals(h.get("content-length"), "2");
    assertEquals(l, 2);
  });
  t.run("len,reader,no-header", () => {
    const h = new Headers();
    const body = new Buffer(new Uint8Array([0, 1]));
    const [r, l] = setupBody(body, h);
    assertEquals(r, body);
    assertEquals(h.get("content-type"), "application/octet-stream");
    assertEquals(h.has("content-length"), false);
    assertEquals(h.get("transfer-encoding"), "chunked");
    assertEquals(l, undefined);
  });
  t.run("len,reader,header", () => {
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
  t.run("len,reader,header,cl", () => {
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
  t.run("chunked,string,no-header", () => {
    const h = new Headers({ "transfer-encoding": "chunked" });
    const [r, l] = setupBody("ok", h);
    assertEquals(r instanceof Buffer, true);
    assertEquals(h.get("content-type"), "text/plain; charset=UTF-8");
    assertEquals(h.has("content-length"), false);
    assertEquals(h.get("transfer-encoding"), "chunked");
    assertEquals(l, undefined);
  });
  t.run("chunked,string,header", () => {
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
  t.run("chunked,bin,no-header", () => {
    const h = new Headers({ "transfer-encoding": "chunked" });
    const [r, l] = setupBody(new Uint8Array([0, 1]), h);
    assertEquals(r instanceof Buffer, true);
    assertEquals(h.get("content-type"), "application/octet-stream");
    assertEquals(h.get("transfer-encoding"), "chunked");
    assertEquals(h.has("content-length"), false);
    assertEquals(l, undefined);
  });
  t.run("chunked,bin,header", () => {
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
  t.run("chunked,reader,no-header", () => {
    const h = new Headers({ "transfer-encoding": "chunked" });
    const body = new Buffer(new Uint8Array([0, 1]));
    const [r, l] = setupBody(body, h);
    assertEquals(r, body);
    assertEquals(h.get("content-type"), "application/octet-stream");
    assertEquals(h.has("content-length"), false);
    assertEquals(h.get("transfer-encoding"), "chunked");
    assertEquals(l, undefined);
  });
  t.run("chunked,reader,header", () => {
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

it("serveio/keep-alive", (t) => {
  t.run("serveioParseKeepAlive", function () {
    const ka = parseKeepAlive(
      new Headers({
        "keep-alive": "timeout=5, max=100",
      }),
    );
    assertEquals(ka.timeout, 5);
    assertEquals(ka.max, 100);
  });
});
