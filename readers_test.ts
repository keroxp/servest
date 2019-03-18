// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { runIfMain, test } from "https://deno.land/std@v0.3.1/testing/mod.ts";
import { TimeoutReader } from "./readers.ts";
import ReadResult = Deno.ReadResult;
import { assertThrowsAsync } from "https://deno.land/std@v0.3.1/testing/asserts.ts";

test(async function readersTimeoutReader() {
  const r = new TimeoutReader(
    {
      read(p: Uint8Array): Promise<ReadResult> {
        return new Promise<ReadResult>(resolve => {
          setTimeout(() => resolve({ eof: true, nread: 0 }), 200);
        });
      }
    },
    100
  );
  await assertThrowsAsync(
    async () => {
      await r.read(null);
    },
    Error,
    "timeout"
  );
});

runIfMain(import.meta);
