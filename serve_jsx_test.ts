// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { createRecorder } from "./testing.ts";
import {
  assertEquals,
  assertMatch,
  assertThrowsAsync,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { serveJsx } from "./serve_jsx.ts";
import { pathResolver, readString } from "./util.ts";
import { group } from "./test_util.ts";

group("serveJsx", (t) => {
  const func = serveJsx(
    pathResolver(import.meta)("./fixtures/public"),
    (f) => import(f),
  );
  t.test("basic", async () => {
    const rec = createRecorder({
      url: "/",
      method: "GET",
    });
    await func(rec);
    const resp = await rec.response();
    assertEquals(resp.status, 200);
    assertMatch(resp.headers.get("content-type")!, /text\/html/);
    assertEquals(
      await readString(resp.body),
      '<html data-reactroot="">deno</html>',
    );
  });
  t.test("should throw if jsx file has no default export", async () => {
    const rec = createRecorder({ url: "/empty", method: "GET" });
    await assertThrowsAsync(
      async () => {
        await func(rec);
      },
      Error,
      "jsx: jsx/tsx files served by serveJsx must has default export!",
    );
  });
  t.test("should throw if default export is not function", async () => {
    const rec = createRecorder({ url: "/not-component", method: "GET" });
    await assertThrowsAsync(async () => {
      await func(rec);
    }, Error, "jsx: default export must be React component!");
  });
});
