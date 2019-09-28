// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { createRouter, findLongestAndNearestMatch } from "./router.ts";
import { runIfMain, test } from "./vendor/https/deno.land/std/testing/mod.ts";
import { defer } from "./promises.ts";
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { it } from "./testing.ts";

([
  ["/foo", ["/foo", "/bar", "/f"], 0],
  ["/foo", ["/foo", "/foo/bar"], 0],
  ["/foo/bar", ["/", "/foo", "/hoo", "/hoo/foo/bar", "/foo/bar"], 4],
  ["/foo/bar/foo", ["/foo", "/foo/bar", "/bar/foo"], 1],
  ["/foo", ["/", "/hoo", "/hoo/foo"], 0],
  ["/deno/land", [/d(.+?)o/, /d(.+?)d/], 1],
  ["/foo", ["/", "/a/foo"], 0],
  ["/foo", [/\/foo/, /\/bar\/foo/], 0],
  ["/foo", [/\/a\/foo/, /\/foo/], 1]
] as [string, (string | RegExp)[], number][]).forEach(([path, pat, idx]) => {
  test("findLongestAndNearestMatch:" + path, () => {
    assertEquals(findLongestAndNearestMatch(path, pat).index, idx);
  });
});

it("router", t => {
  let errorHandled = false;
  t.beforeAfterAll(() => {
    const cancel = defer<void>();
    const router = createRouter();
    router.handle("/index", async req => {
      await req.respond({
        status: 200,
        body: "ok"
      });
    });
    router.handle(new RegExp("/foo/(?<id>.+)"), async req => {
      const { id } = req.match.groups;
      await req.respond({
        status: 200,
        headers: new Headers({
          "content-type": "application/json"
        }),
        body: JSON.stringify({ id })
      });
    });
    router.handle("/no-response", async req => {});
    router.handle("/throw", async req => {
      throw new Error("throw");
    });
    router.handle("/redirect", req => req.redirect("/index"));
    router.handleError((e, req) => {
      errorHandled = true;
    });
    router.listen(
      {
        hostname: "127.0.0.1",
        port: 8898
      },
      { cancel: cancel.promise }
    );
    return () => cancel.resolve();
  });
  t.run("should respond string path", async () => {
    {
      const res1 = await fetch("http://127.0.0.1:8898/index");
      const text = await res1.body.text();
      assertEquals(res1.status, 200);
      assertEquals(text, "ok");
    }
  });
  t.run("should respond regexp path", async () => {
    const res2 = await fetch("http://127.0.0.1:8898/foo/123");
    const json = await res2.body.json();
    assertEquals(res2.status, 200);
    assertEquals(res2.headers.get("content-type"), "application/json");
    assertEquals(json["id"], "123");
  });
  t.run("should respond even if req.respond wasn't called", async () => {
    const res = await fetch("http://127.0.0.1:8898/no-response");
    // assertEquals(res.status, 404);
    const text = await res.body.text();
    assertEquals(text, "Not Found");
  });
  t.run("should respond for unknown path", async () => {
    const res = await fetch("http://127.0.0.1:8898/not-found");
    const text = await res.body.text();
    assertEquals(res.status, 404);
    assertEquals(text, "Not Found");
  });
  t.run("should handle global error", async () => {
    const res = await fetch("http://127.0.0.1:8898/throw");
    const text = await res.body.text();
    assertEquals(res.status, 500);
    assertEquals(text, "Internal Server Error");
    assertEquals(errorHandled, true);
  });
  t.run("should redirect", async () => {
    const res = await fetch("http://127.0.0.1:8898/redirect");
    assertEquals(res.status, 200);
    assertEquals(await res.body.text(), "ok");
  });
});
runIfMain(import.meta);
