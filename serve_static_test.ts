// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { test, runIfMain } from "./vendor/https/deno.land/std/testing/mod.ts";
import {
  assertMatch,
  assertEquals
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { it } from "./testing.ts";
import { createRouter } from "./router.ts";
import { serveStatic } from "./serve_static.ts";

it("serveStatic", t => {
  t.beforeAfterAll(() => {
    const app = createRouter();
    app.use(
      serveStatic("./fixtures/public", {
        contentTypeMap: new Map([[".vue", "application/vue"]])
      })
    );
    const l = app.listen(":8886");
    return () => l.close();
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
      const resp = await fetch("http://127.0.0.1:8886" + path);
      assertEquals(resp.status, 200);
      const contentType = resp.headers.get("content-type");
      assertMatch(contentType, new RegExp(type));
    });
  });
});

runIfMain(import.meta);
