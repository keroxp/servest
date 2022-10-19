// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { findLongestAndNearestMatches, resolveIndexPath } from "./_matcher.ts";
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";

Deno.test("matcher", async (t) => {
  type Pat = [string, (string | RegExp)[], number[]][];
  const cases: Pat = [
    ["/foo", ["/foo", "/bar", "/f"], [0]],
    ["/foo", ["/foo", "/foo/bar"], [0]],
    ["/foo/bar", ["/", "/foo", "/hoo", "/hoo/foo/bar", "/foo/bar"], [4]],
    ["/foo/bar/foo", ["/foo", "/foo/bar", "/bar/foo", "/foo/bar/foo"], [3]],
    ["/foo", ["/", "/hoo", "/hoo/foo"], []],
    ["/deno/land", [/d(.+?)o/, /d(.+?)d/], [1]],
    ["/foo", ["/", "/a/foo", "/foo"], [2]],
    ["/foo", [/\/foo/, /\/bar\/foo/], [0]],
    ["/foo", [/\/a\/foo/, /\/foo/], [1]],
  ];
  for (const [path, pat, idx] of cases) {
    await t.step("findLongestAndNearestMatch:" + path, () => {
      const matches = findLongestAndNearestMatches(path, pat);
      assertEquals(matches.length, idx.length);
      for (let i = 0; i < idx.length; i++) {
        assertEquals(matches[i][0], idx[i]);
      }
    });
  }

  await t.step("resolveIndexPath", async () => {
    for (
      const [dir, fp, exp] of [
        [".", "/README.md", "README.md"],
        ["./fixtures/public", "/", "fixtures/public/index.html"],
        ["./fixtures/public", "/index", "fixtures/public/index.html"],
        ["./fixtures/public", "/index.html", "fixtures/public/index.html"],
        ["./fixtures/public", "/nofile", undefined],
      ] as [string, string, string | undefined][]
    ) {
      assertEquals(await resolveIndexPath(dir, fp), exp);
    }
  });
});
