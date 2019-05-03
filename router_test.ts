// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { createRouter, findLongestAndNearestMatch } from "./router.ts";
import { runIfMain, test } from "https://deno.land/std@v0.3.4/testing/mod.ts";
import { defer } from "./promises.ts";
import {
  assert,
  assertEquals
} from "https://deno.land/std@v0.3.4/testing/asserts.ts";
import { StringReader } from "https://deno.land/std@v0.3.4/io/readers.ts";

test(function httpMatchNearest() {
  assertEquals(
    findLongestAndNearestMatch("/foo", ["/foo", "/bar", "/f"]).index,
    0
  );
  assertEquals(
    findLongestAndNearestMatch("/foo", ["/foo", "/foo/bar"]).index,
    0
  );
  assertEquals(
    findLongestAndNearestMatch("/foo/bar", [
      "/",
      "/foo",
      "/hoo",
      "/hoo/foo/bar",
      "/foo/bar"
    ]).index,
    4
  );
  assertEquals(
    findLongestAndNearestMatch("/foo/bar/foo", ["/foo", "/foo/bar", "/bar/foo"])
      .index,
    1
  );
  assertEquals(
    findLongestAndNearestMatch("/foo", ["/", "/hoo", "/hoo/foo"]).index,
    0
  );
  assertEquals(
    findLongestAndNearestMatch("/deno/land", [/d(.+?)o/, /d(.+?)d/]).index,
    1
  );
  assertEquals(findLongestAndNearestMatch("/foo", ["/", "/a/foo"]).index, 0);
  assertEquals(
    findLongestAndNearestMatch("/foo", [/\/foo/, /\/bar\/foo/]).index,
    0
  );
  assertEquals(
    findLongestAndNearestMatch("/foo", [/\/a\/foo/, /\/foo/]).index,
    1
  );
});
test(async function router() {
  const server = createRouter();
  server.handle("/index", async req => {
    await req.respond({
      status: 200,
      headers: new Headers({
        "content-type": "text/plain"
      }),
      body: new StringReader("ok")
    });
  });
  server.handle(new RegExp("/foo/(?<id>.+)"), async req => {
    const { id } = req.match.groups;
    await req.respond({
      status: 200,
      headers: new Headers({
        "content-type": "application/json"
      }),
      body: new StringReader(JSON.stringify({ id }))
    });
  });
  server.handle("/no-response", async req => {});
  const cancel = defer<void>();
  try {
    server.listen("127.0.0.1:8898", { cancel: cancel.promise });
    {
      const res1 = await fetch("http://127.0.0.1:8898/index");
      const text = await res1.body.text();
      assertEquals(res1.status, 200);
      assertEquals(text, "ok");
    }
    {
      const res2 = await fetch("http://127.0.0.1:8898/foo/123");
      const json = await res2.body.json();
      assertEquals(res2.status, 200);
      assertEquals(res2.headers.get("content-type"), "application/json");
      assertEquals(json["id"], "123");
    }
    {
      const res = await fetch("http://127.0.0.1:8898/no-response");
      assertEquals(res.status, 500);
      const text = await res.body.text();
      assert(!!text.match("Not Responded"));
    }
    {
      const res = await fetch("http://127.0.0.1:8898/not-found");
      const text = await res.body.text();
      assertEquals(res.status, 404);
      assert(!!text.match("Not Found"));
    }
  } finally {
    cancel.resolve();
  }
});

runIfMain(import.meta);
