// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { streamReader } from "./_readers.ts";
import {
  assertEquals,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { group } from "./_test_util.ts";
import { encode, decode } from "./vendor/https/deno.land/std/encoding/utf8.ts";

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
    let result: null | number = 0;
    while ((result = await sr.read(buf)) !== null) {
      await dest.write(buf.subarray(0, result));
    }
    assertEquals(decode(dest.bytes()), "Go To -> [deno.land]");
  });
});
