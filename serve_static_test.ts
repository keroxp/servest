// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import {
  assertEquals,
  assertMatch,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { createRecorder } from "./testing.ts";
import { serveStatic } from "./serve_static.ts";
import { group } from "./test_util.ts";
import { createApp } from "./app.ts";

group("serveStatic", (t) => {
  const func = serveStatic("./fixtures/public", {
    contentTypeMap: new Map([[".vue", "application/vue"]]),
  });
  const data: [string, string][] = [
    ["/", "text/html"],
    ["/about/", "text/html"],
    ["/doc", "text/html"],
    ["/index.css", "text/css"],
    ["/index.ts", "application/javascript"],
    ["/index.js", "application/javascript"],
    ["/sample.vue", "application/vue"],
    ["/sample.xx", "application/octet-stream"],
  ];
  data.forEach(([path, type]) => {
    t.test(path, async () => {
      const rec = createRecorder({ url: path });
      await func(rec);
      const resp = await rec.response();
      assertEquals(resp.status, 200);
      const contentType = resp.headers.get("content-type");
      assertMatch(contentType!, new RegExp(type));
    });
  });
});

group("serveStatic integration", (t) => {
  t.setupAll(() => {
    const router = createApp();
    router.use(serveStatic("./fixtures/public"));
    const l = router.listen({ port: 9988 });
    return () => l.close();
  });
  t.test("basic", async () => {
    const resp = await fetch("http://127.0.0.1:9988/index.html");
    assertEquals(resp.status, 200);
    resp.body.close();
  });
  t.test("not found", async () => {
    const resp = await fetch("http://127.0.0.1:9988/no-file");
    assertEquals(resp.status, 404);
    resp.body.close();
  });
  t.test("Capitalized", async () => {
    const resp = await fetch("http://127.0.0.1:9988/File.txt");
    assertEquals(resp.status, 200);
    resp.body.close();
  });
  t.test("Multi bytes", async () => {
    const resp = await fetch("http://127.0.0.1:9988/日本語.txt");
    assertEquals(resp.status, 200);
    resp.body.close();
  });
});
