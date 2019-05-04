// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { runIfMain, test } from "https://deno.land/std@v0.4.0/testing/mod.ts";
import { BodyReader, TimeoutReader } from "./readers.ts";
import { assertThrowsAsync } from "https://deno.land/std@v0.4.0/testing/asserts.ts";
import ReadResult = Deno.ReadResult;
import { BufReader } from "https://deno.land/std@v0.4.0/io/bufio.ts";
import { StringReader } from "https://deno.land/std@v0.4.0/io/readers.ts";
import { assertEquals } from "https://deno.land/std@v0.4.0/testing/asserts.ts";
import { decode } from "https://deno.land/std@v0.4.0/strings/strings.ts";
import { TimeoutError } from "./promises.ts";

test(async function readersBodyReader() {
  const bufr = new BufReader(new StringReader("okdenoland"));
  const buf = new Uint8Array(100);
  {
    const b = new BodyReader(bufr, 2);
    const { nread, eof } = await b.read(buf);
    assertEquals(nread, 2);
    assertEquals(eof, true);
    assertEquals(decode(buf.slice(0, 2)), "ok");
  }
  {
    const b = new BodyReader(bufr, 4);
    const { nread, eof } = await b.read(buf);
    assertEquals(nread, 4);
    assertEquals(eof, true);
    assertEquals(decode(buf.slice(0, 4)), "deno");
  }
  {
    const b = new BodyReader(bufr, 4);
    const { nread, eof } = await b.read(buf);
    assertEquals(nread, 4);
    assertEquals(eof, true);
    assertEquals(decode(buf.slice(0, 4)), "land");
  }
});

test(async function readersTimeoutReader() {
  const r = new TimeoutReader(
    {
      read(p: Uint8Array): Promise<ReadResult> {
        return new Promise<ReadResult>(resolve => {
          setTimeout(() => resolve({ eof: true, nread: 0 }), 200);
        });
      }
    },
    {
      timeout: 100
    }
  );
  await assertThrowsAsync(async () => {
    await r.read(null);
  }, TimeoutError);
});

runIfMain(import.meta);
