// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { test, runIfMain } from "./vendor/https/deno.land/std/testing/mod.ts";
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { dateToDateHeader, pathResolver } from "./util.ts";
import { it } from "./test_util.ts";

test("dateToDateHeader", () => {
  const res = dateToDateHeader(new Date("2019-09-15T08:20:15Z"));
  assertEquals(res, "Sun, 15 Sep 2019 08:20:15 GMT");
});
it("pathResolver", t => {
  [
    ["file://src/deno/index.js", "./other.js", "file://src/deno/other.js"],
    ["file://src/deno/", "./other.js", "file://src/deno/other.js"]
  ].forEach(([base, path, exp]) => {
    t.run(`${base} + ${path}`, () => {
      const u = pathResolver(base)(path);
      assertEquals(u.toString(), exp);
    });
  });
});
runIfMain(import.meta);
