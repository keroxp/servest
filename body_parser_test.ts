// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import {
  MultipartWriter,
} from "./vendor/https/deno.land/std/mime/multipart.ts";
import {
  assert,
  assertEquals,
  assertThrowsAsync,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { parserMultipartRequest, createBodyParser } from "./body_parser.ts";
import * as fs from "./vendor/https/deno.land/std/fs/mod.ts";
import Buffer = Deno.Buffer;
import { group } from "./test_util.ts";
import { StringReader } from "./vendor/https/deno.land/std/io/readers.ts";

group("multipart", ({ test }) => {
  test("basic", async () => {
    const buf = new Buffer();
    const w = new MultipartWriter(buf);
    await w.writeField("deno", "land");
    const f = await Deno.open("./README.md");
    await w.writeFile("file", "README.md", f);
    await w.close();
    f.close();
    const m = await parserMultipartRequest(
      {
        headers: new Headers({
          "content-type": w.formDataContentType(),
        }),
        body: buf,
      },
      1000,
    );
    assertEquals(m.value("hoge"), undefined);
    assertEquals(m.value("deno"), "land");
    const mfile = m.file("file")!;
    assertEquals(mfile.filename, "README.md");
    assert(mfile.tempfile !== undefined, "temp file should be created");
    await m.removeAll();
    assertEquals(await fs.exists(mfile.tempfile!), false);
  });
  test("should throw if content-type is invalid", async () => {
    const body = new Buffer();
    await assertThrowsAsync(async () => {
      await parserMultipartRequest({
        headers: new Headers(),
        body,
      });
    }, Error, "is not multipart");
    await assertThrowsAsync(async () => {
      await parserMultipartRequest({
        headers: new Headers({
          "content-type": "application/json",
        }),
        body,
      });
    }, Error, "is not multipart");
    await assertThrowsAsync(async () => {
      await parserMultipartRequest({
        headers: new Headers({
          "content-type": "multipart/form-data; ",
        }),
        body,
      });
    }, Error, "doesn't have boundary");
  });
});

group("bodyParser", ({ test }) => {
  test("text()", async () => {
    const s = "denoland";
    const r = new StringReader(s);
    const br = createBodyParser({
      reader: r,
      contentType: "text/plain",
    });
    assertEquals(await br.text(), s);
  });
  test("text() should return empty string if body is empty", async () => {
    const s = "";
    const r = new StringReader(s);
    const br = createBodyParser({ reader: r, contentType: "text/plain" });
    assertEquals(await br.text(), "");
    assertEquals(await br.text(), "");
  });
  test("json()", async () => {
    const j = { deno: "land" };
    const s = JSON.stringify(j);
    const r = new StringReader(s);
    const br = createBodyParser({ reader: r, contentType: "application/json" });
    assertEquals(await br.json(), j);
    assertEquals(await br.json(), j);
  });
  test("json() should throw if input is invalid", async () => {
    const j = `{ deno: "land" `;
    const r = new StringReader(j);
    const br = createBodyParser({ reader: r, contentType: "application/json" });
    await assertThrowsAsync(async () => {
      await br.json();
    }, SyntaxError, "JSON");
  });
  test("arrayBuffer()", async () => {
    const bin = new Deno.Buffer(new Uint8Array([0, 1, 2, 3]));
    const br = createBodyParser(
      { reader: bin, contentType: "application/octet-stream" },
    );
    assertEquals([...(await br.arrayBuffer()).values()], [0, 1, 2, 3]);
    assertEquals([...(await br.arrayBuffer()).values()], [0, 1, 2, 3]);
  });
  test("formData(), urlencoded", async () => {
    const s = "deno=land&での=らんど&👉=🦕";
    const e = encodeURIComponent(s);
    const r = new StringReader(e);
    const br = createBodyParser(
      { reader: r, contentType: "application/x-www-form-urlencoded" },
    );
    const f = await br.formData();
    assertEquals(f.value("deno"), "land");
    assertEquals(f.value("での"), "らんど");
    assertEquals(f.value("👉"), "🦕");
  });
  test("formData() should throw if invalid content type", async () => {
    const br = createBodyParser(
      { reader: new StringReader("deno=land"), contentType: "text/plain" },
    );
    await assertThrowsAsync(
      async () => {
        await br.formData();
      },
      Error,
      "request is not multipart/form-data nor application/x-www-form-urlencoded",
    );
  });
  test("multi transforming", async () => {
    const s = `{"deno": "land"}`;
    const encoder = new TextEncoder();
    const br = createBodyParser(
      { reader: new StringReader(s), contentType: "text/plain" },
    );
    assertEquals(await br.arrayBuffer(), encoder.encode(s));
    assertEquals(await br.text(), s);
    assertEquals(await br.json(), JSON.parse(s));
  });
});
