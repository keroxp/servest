// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { runIfMain } from "./vendor/https/deno.land/std/testing/mod.ts";
import {
  assertEquals,
  assertMatch
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { createRecorder } from "./testing.ts";
import { serveStatic } from "./serve_static.ts";
import { it } from "./test_util.ts";

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
      assertMatch(contentType, new RegExp(type));
    });
  });
});

runIfMain(import.meta);
