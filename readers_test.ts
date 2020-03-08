// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { bodyReader, chunkedBodyReader } from "./readers.ts";
import {
  assertEquals,
  assertThrowsAsync
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { BufReader } from "./vendor/https/deno.land/std/io/bufio.ts";
import { StringReader } from "./vendor/https/deno.land/std/io/readers.ts";
import { decode } from "./vendor/https/deno.land/std/strings/decode.ts";
import { it } from "./test_util.ts";

it("bodyReader", t => {
  t.run("basic", async () => {
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
  t.run("text()", async () => {
    const s = "denoland";
    const r = new StringReader(s);
    const br = bodyReader(r, s.length);
    assertEquals(await br.text(), s);
  });
  t.run("text() should return empty string if body is empty", async () => {
    const s = "";
    const r = new StringReader(s);
    const br = bodyReader(r, 0);
    assertEquals(await br.text(), "");
    assertEquals(await br.text(), "");
  });
  t.run("json()", async () => {
    const j = { deno: "land" };
    const s = JSON.stringify(j);
    const r = new StringReader(s);
    const br = bodyReader(r, s.length);
    assertEquals(await br.json(), j);
    assertEquals(await br.json(), j);
  });
  t.run("json() should throw if input is invalid", async () => {
    const j = `{ deno: "land" `;
    const r = new StringReader(j);
    const br = bodyReader(r, j.length);
    await assertThrowsAsync(async () => {
      await br.json();
    }, SyntaxError, "JSON");
  });
  t.run("arrayBuffer()", async () => {
    const bin = new Deno.Buffer(new Uint8Array([0, 1, 2, 3]));
    const br = bodyReader(bin, 4);
    assertEquals([...(await br.arrayBuffer()).values()], [0, 1, 2, 3]);
    assertEquals([...(await br.arrayBuffer()).values()], [0, 1, 2, 3]);
  });
  t.run("formData(), urlencoded", async () => {
    const s = "deno=land&での=らんど&👉=🦕";
    const e = encodeURIComponent(s);
    const r = new StringReader(e);
    const br = bodyReader(r, e.length);
    const f = await br.formData(
      new Headers({
        "content-type": "application/x-www-form-urlencoded"
      })
    );
    assertEquals(f.field("deno"), "land");
    assertEquals(f.field("での"), "らんど");
    assertEquals(f.field("👉"), "🦕");
  });
  t.run("formData() should throw if invalid content type", async () => {
    const br = bodyReader(new StringReader("deno=land"), 9);
    await assertThrowsAsync(
      async () => {
        await br.formData(new Headers({ "content-type": "text/plain" }));
      },
      Error,
      "request is not multipart/form-data nor application/x-www-form-urlencoded"
    );
  });
  t.run("multi transforming", async () => {
    const s = `{"deno": "land"}`;
    const encoder = new TextEncoder();
    const br = bodyReader(new StringReader(s), s.length);
    assertEquals(await br.arrayBuffer(), encoder.encode(s));
    assertEquals(await br.text(), s);
    assertEquals(await br.json(), JSON.parse(s));
  });
});

it("chunkedBodyReader", t => {
  t.run("basic", async () => {
    const s = `4\r\ndeno\r\n4\r\nland\r\n0\r\n\r\n`;
    const br = chunkedBodyReader(new StringReader(s));
    const buf = new Deno.Buffer();
    await Deno.copy(buf, br);
    assertEquals(buf.toString(), "denoland");
  });
});
