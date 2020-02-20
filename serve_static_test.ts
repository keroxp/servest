// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import {
  assertEquals,
  assertMatch
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { createRecorder } from "./testing.ts";
import { serveStatic } from "./serve_static.ts";
import { it } from "./test_util.ts";
import { createRouter } from "./router.ts";

it("serveStatic", t => {
  const func = serveStatic("./fixtures/public", {
    contentTypeMap: new Map([[".vue", "application/vue"]])
  });
  const data: [string, string][] = [
    ["/", "text/html"],
    ["/about/", "text/html"],
    ["/doc", "text/html"],
    ["/index.css", "text/css"],
    ["/index.ts", "application/javascript"],
    ["/index.js", "application/javascript"],
    ["/sample.vue", "application/vue"],
    ["/sample.xx", "application/octet-stream"]
  ];
  data.forEach(([path, type]) => {
    t.run(path, async () => {
      const rec = createRecorder({ url: path });
      await func(rec);
      const resp = await rec.response();
      assertEquals(resp.status, 200);
      const contentType = resp.headers.get("content-type");
      assertMatch(contentType!, new RegExp(type));
    });
  });
});

it("serveStatic integration", t => {
  t.beforeAfterAll(() => {
    const router = createRouter();
    router.use(serveStatic("./fixtures/public"));
    const l = router.listen(":9988");
    return () => l.close();
  });
  t.run("basic", async () => {
    const resp = await fetch("http://127.0.0.1:9988/index.html");
    assertEquals(resp.status, 200);
  });
  t.run("not found", async () => {
    const resp = await fetch("http://127.0.0.1:9988/no-file");
    assertEquals(resp.status, 404);
  });
  t.run("Capitalized", async () => {
    const resp = await fetch("http://127.0.0.1:9988/File.txt");
    assertEquals(resp.status, 200);
  });
  t.run("Multi bytes", async () => {
    const resp = await fetch("http://127.0.0.1:9988/日本語.txt");
    assertEquals(resp.status, 200);
  });
});

