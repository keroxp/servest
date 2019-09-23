// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { createRouter, findLongestAndNearestMatch } from "./router.ts";
import { runIfMain, test } from "./vendor/https/deno.land/std/testing/mod.ts";
import { defer } from "./promises.ts";
import {
  assert,
  assertEquals
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { StringReader } from "./vendor/https/deno.land/std/io/readers.ts";

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
let errorHandled = false;
router.handleError((e, req) => {
  errorHandled = true;
});
const cancel = defer<void>();
router.listen("127.0.0.1:8898", { cancel: cancel.promise });
test("router should respond string path", async () => {
  {
    const res1 = await fetch("http://127.0.0.1:8898/index");
    const text = await res1.body.text();
    assertEquals(res1.status, 200);
    assertEquals(text, "ok");
  }
});
test("router should respond regexp path", async () => {
  const res2 = await fetch("http://127.0.0.1:8898/foo/123");
  const json = await res2.body.json();
  assertEquals(res2.status, 200);
  assertEquals(res2.headers.get("content-type"), "application/json");
  assertEquals(json["id"], "123");
});
test("router should respond even if req.respond wasn't called", async () => {
  const res = await fetch("http://127.0.0.1:8898/no-response");
  // assertEquals(res.status, 404);
  const text = await res.body.text();
  assertEquals(text, "Not Found");
});
test("router should respond for unknown path", async () => {
  const res = await fetch("http://127.0.0.1:8898/not-found");
  const text = await res.body.text();
  assertEquals(res.status, 404);
  assertEquals(text, "Not Found");
});
test("router should handle global error", async () => {
  const res = await fetch("http://127.0.0.1:8898/throw");
  const text = await res.body.text();
  assertEquals(res.status, 500);
  assertEquals(text, "Internal Server Error");
  assertEquals(errorHandled, true);
});

runIfMain(import.meta);
