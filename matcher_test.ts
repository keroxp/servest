// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import {
  findLongestAndNearestMatches,
  resolveIndexPath
} from "./matcher.ts";
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { it } from "./test_util.ts";

it("matcher", t => {
  type Pat = [string, (string | RegExp)[], number[]][];
  ([
    ["/foo", ["/foo", "/bar", "/f"], [0]],
    ["/foo", ["/foo", "/foo/bar"], [0]],
    ["/foo/bar", ["/", "/foo", "/hoo", "/hoo/foo/bar", "/foo/bar"], [4]],
    ["/foo/bar/foo", ["/foo", "/foo/bar", "/bar/foo", "/foo/bar/foo"], [3]],
    ["/foo", ["/", "/hoo", "/hoo/foo"], []],
    ["/deno/land", [/d(.+?)o/, /d(.+?)d/], [1]],
    ["/foo", ["/", "/a/foo", "/foo"], [2]],
    ["/foo", [/\/foo/, /\/bar\/foo/], [0]],
    ["/foo", [/\/a\/foo/, /\/foo/], [1]]
  ] as Pat).forEach(([path, pat, idx]) => {
    t.run("findLongestAndNearestMatch:" + path, () => {
      const matches = findLongestAndNearestMatches(path, pat);
      assertEquals(matches.length, idx.length);
      for (let i = 0; i < idx.length; i++) {
        assertEquals(matches[i][0], idx[i]);
      }
    });
  });

  t.run("resolveIndexPath", async () => {
    for (
      const [dir, fp, exp] of [
        [".", "/README.md", "README.md"],
        ["./fixtures/public", "/", "fixtures/public/index.html"],
        ["./fixtures/public", "/index", "fixtures/public/index.html"],
        ["./fixtures/public", "/index.html", "fixtures/public/index.html"],
        ["./fixtures/public", "/nofile", undefined]
      ] as [string, string, string | undefined][]
    ) {
      assertEquals(await resolveIndexPath(dir, fp), exp);
    }
  });
});
