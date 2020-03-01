// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { findLongestAndNearestMatch, resolveIndexPath } from "./router_util.ts";
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { it } from "./test_util.ts";

it("router_util", t => {
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
    t.run("findLongestAndNearestMatch:" + path, () => {
      assertEquals(findLongestAndNearestMatch(path, pat).index, idx);
    });
  });

  t.run("resolveIndexPath", async () => {
    for (const [dir, fp, exp] of [
      [".", "/README.md", "README.md"],
      ["./fixtures/public", "/", "fixtures/public/index.html"],
      ["./fixtures/public", "/index", "fixtures/public/index.html"],
      ["./fixtures/public", "/index.html", "fixtures/public/index.html"],
      ["./fixtures/public", "/nofile", undefined]
    ] as [string, string, string | undefined][]) {
      assertEquals(await resolveIndexPath(dir, fp), exp);
    }
  });
});
