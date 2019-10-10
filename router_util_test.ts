// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { findLongestAndNearestMatch, resolveIndexPath } from "./router_util.ts";
import { runIfMain, test } from "./vendor/https/deno.land/std/testing/mod.ts";
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";

([
  ["/foo", ["/foo", "/bar", "/f"], 0],
  ["/foo", ["/foo", "/foo/bar"], 0],
  ["/foo/bar", ["/", "/foo", "/hoo", "/hoo/foo/bar", "/foo/bar"], 4],
  ["/foo/bar/foo", ["/foo", "/foo/bar", "/bar/foo", "/foo/bar/foo"], 3],
  ["/foo", ["/", "/hoo", "/hoo/foo"], -1],
  ["/deno/land", [/d(.+?)o/, /d(.+?)d/], 1],
  ["/foo", ["/", "/a/foo", "/foo"], 2],
  ["/foo", [/\/foo/, /\/bar\/foo/], 0],
  ["/foo", [/\/a\/foo/, /\/foo/], 1]
] as [string, (string | RegExp)[], number][]).forEach(([path, pat, idx]) => {
  test("findLongestAndNearestMatch:" + path, () => {
    assertEquals(findLongestAndNearestMatch(path, pat).index, idx);
  });
});

test("resolveIndexPath", async () => {
  for (const [dir, fp, exp] of [
    [".", "/README.md", "README.md"],
    ["./fixtures/public", "/", "fixtures/public/index.html"],
    ["./fixtures/public", "/index", "fixtures/public/index.html"],
    ["./fixtures/public", "/index.html", "fixtures/public/index.html"],
    ["./fixtures/public", "/nofile", undefined]
  ]) {
    assertEquals(await resolveIndexPath(dir, fp), exp);
  }
});

runIfMain(import.meta);
