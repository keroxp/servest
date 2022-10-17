// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { createRecorder } from "./testing.ts";
import {
  assertEquals,
  assertMatch,
  assertThrowsAsync,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { serveJsx } from "./serve_jsx.ts";
import { pathResolver } from "./_util.ts";

Deno.test("serveJsx", async (t) => {
  const func = serveJsx(
    pathResolver(import.meta)("./fixtures/public"),
    (f) => import(f),
  );
  await t.step("basic", async () => {
    const rec = createRecorder({
      url: "/",
      method: "GET",
    });
    await func(rec);
    const resp = await rec.response();
    assertEquals(resp.status, 200);
    assertMatch(resp.headers.get("content-type")!, /text\/html/);
    assertEquals(
      await resp.text(),
      '<html data-reactroot="">deno</html>',
    );
  });
  await t.step("should throw if jsx file has no default export", async () => {
    const rec = createRecorder({ url: "/empty", method: "GET" });
    await assertThrowsAsync(
      async () => {
        await func(rec);
      },
      Error,
      "jsx: jsx/tsx files served by serveJsx must has default export!",
    );
  });
  await t.step("should throw if default export is not function", async () => {
    const rec = createRecorder({ url: "/not-component", method: "GET" });
    await assertThrowsAsync(
      async () => {
        await func(rec);
      },
      Error,
      "jsx: default export must be React component!",
    );
  });
});
