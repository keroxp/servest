// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { streamReader } from "./readers.ts";
import {
  assertEquals,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { group } from "./test_util.ts";
import { encode } from "./vendor/https/deno.land/std/encoding/utf8.ts";

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
