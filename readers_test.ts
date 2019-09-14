// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { runIfMain, test } from "./vendor/https/deno.land/std/testing/mod.ts";
import { BodyReader, TimeoutReader } from "./readers.ts";
import {
  assertEquals,
  assertThrowsAsync
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { BufReader } from "./vendor/https/deno.land/std/io/bufio.ts";
import { StringReader } from "./vendor/https/deno.land/std/io/readers.ts";
import { decode } from "./vendor/https/deno.land/std/strings/decode.ts";
import { TimeoutError } from "./promises.ts";

test(async function readersBodyReader() {
  const bufr = new BufReader(new StringReader("okdenoland"));
  const buf = new Uint8Array(100);
  {
    const b = new BodyReader(bufr, 2);
    let nread = await b.read(buf);
    assertEquals(nread, 2);
    nread = await b.read(buf);
    assertEquals(nread, Deno.EOF);
    assertEquals(decode(buf.slice(0, 2)), "ok");
  }
  {
    const b = new BodyReader(bufr, 4);
    let nread = await b.read(buf);
    assertEquals(nread, 4);
    nread = await b.read(buf);
    assertEquals(nread, Deno.EOF);
    assertEquals(decode(buf.slice(0, 4)), "deno");
  }
  {
    const b = new BodyReader(bufr, 4);
    let nread = await b.read(buf);
    assertEquals(nread, 4);
    nread = await b.read(buf);
    assertEquals(nread, Deno.EOF);
    assertEquals(decode(buf.slice(0, 4)), "land");
  }
});

test(async function readersTimeoutReader() {
  const r = new TimeoutReader(
    {
      read(p: Uint8Array): Promise<number | Deno.EOF> {
        return new Promise(resolve => {
          setTimeout(() => resolve(Deno.EOF), 200);
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
