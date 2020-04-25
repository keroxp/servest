// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { bodyReader, chunkedBodyReader, streamReader } from "./readers.ts";
import {
  assertEquals,
  assertThrowsAsync,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { BufReader } from "./vendor/https/deno.land/std/io/bufio.ts";
import { StringReader } from "./vendor/https/deno.land/std/io/readers.ts";
import { decode, encode } from "./vendor/https/deno.land/std/encoding/utf8.ts";
import { group } from "./test_util.ts";

group("bodyReader", ({ test }) => {
  test("basic", async () => {
    const bufr = new BufReader(new StringReader("okdenoland"));
    const buf = new Uint8Array(100);
    {
      const b = bodyReader(bufr, 2);
      let nread = await b.read(buf);
      assertEquals(nread, 2);
      nread = await b.read(buf);
      assertEquals(nread, Deno.EOF);
      assertEquals(decode(buf.slice(0, 2)), "ok");
    }
    {
      const b = bodyReader(bufr, 4);
      let nread = await b.read(buf);
      assertEquals(nread, 4);
      nread = await b.read(buf);
      assertEquals(nread, Deno.EOF);
      assertEquals(decode(buf.slice(0, 4)), "deno");
    }
    {
      const b = bodyReader(bufr, 4);
      let nread = await b.read(buf);
      assertEquals(nread, 4);
      nread = await b.read(buf);
      assertEquals(nread, Deno.EOF);
      assertEquals(decode(buf.slice(0, 4)), "land");
    }
  });
  test("text()", async () => {
    const s = "denoland";
    const r = new StringReader(s);
    const br = bodyReader(r, s.length);
    assertEquals(await br.text(), s);
  });
  test("text() should return empty string if body is empty", async () => {
    const s = "";
    const r = new StringReader(s);
    const br = bodyReader(r, 0);
    assertEquals(await br.text(), "");
    assertEquals(await br.text(), "");
  });
  test("json()", async () => {
    const j = { deno: "land" };
    const s = JSON.stringify(j);
    const r = new StringReader(s);
    const br = bodyReader(r, s.length);
    assertEquals(await br.json(), j);
    assertEquals(await br.json(), j);
  });
  test("json() should throw if input is invalid", async () => {
    const j = `{ deno: "land" `;
    const r = new StringReader(j);
    const br = bodyReader(r, j.length);
    await assertThrowsAsync(async () => {
      await br.json();
    }, SyntaxError, "JSON");
  });
  test("arrayBuffer()", async () => {
    const bin = new Deno.Buffer(new Uint8Array([0, 1, 2, 3]));
    const br = bodyReader(bin, 4);
    assertEquals([...(await br.arrayBuffer()).values()], [0, 1, 2, 3]);
    assertEquals([...(await br.arrayBuffer()).values()], [0, 1, 2, 3]);
  });
  test("formData(), urlencoded", async () => {
    const s = "deno=land&での=らんど&👉=🦕";
    const e = encodeURIComponent(s);
    const r = new StringReader(e);
    const br = bodyReader(r, e.length);
    const f = await br.formData(
      new Headers({
        "content-type": "application/x-www-form-urlencoded",
      }),
    );
    assertEquals(f.value("deno"), "land");
    assertEquals(f.value("での"), "らんど");
    assertEquals(f.value("👉"), "🦕");
  });
  test("formData() should throw if invalid content type", async () => {
    const br = bodyReader(new StringReader("deno=land"), 9);
    await assertThrowsAsync(
      async () => {
        await br.formData(new Headers({ "content-type": "text/plain" }));
      },
      Error,
      "request is not multipart/form-data nor application/x-www-form-urlencoded",
    );
  });
  test("multi transforming", async () => {
    const s = `{"deno": "land"}`;
    const encoder = new TextEncoder();
    const br = bodyReader(new StringReader(s), s.length);
    assertEquals(await br.arrayBuffer(), encoder.encode(s));
    assertEquals(await br.text(), s);
    assertEquals(await br.json(), JSON.parse(s));
  });
});

group("chunkedBodyReader", ({ test }) => {
  test("basic", async () => {
    const s = `4\r\ndeno\r\n4\r\nland\r\n0\r\n\r\n`;
    const br = chunkedBodyReader(new StringReader(s));
    const buf = new Deno.Buffer();
    await Deno.copy(buf, br);
    assertEquals(buf.toString(), "denoland");
  });
});

group("streamReader", ({ test }) => {
  test("basic", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(encode("Go "));
        ctrl.enqueue(encode("To "));
        ctrl.enqueue(encode("-> [deno.land]"));
        ctrl.close();
      },
    });
    const sr = streamReader(stream);
    const buf = new Uint8Array(3);
    const dest = new Deno.Buffer();
    let result: Deno.EOF | number = 0;
    while ((result = await sr.read(buf)) !== Deno.EOF) {
      await dest.write(buf.subarray(0, result));
    }
    assertEquals(dest.toString(), "Go To -> [deno.land]");
  });
});
