// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { test, runIfMain } from "./vendor/https/deno.land/std/testing/mod.ts";
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { dateToIMF, pathResolver } from "./util.ts";
import { it } from "./test_util.ts";

test("dateToIMF", () => {
  const res = dateToIMF(new Date("2019-09-15T08:20:15Z"));
  assertEquals(res, "Sun, 15 Sep 2019 08:20:15 GMT");
});
it("pathResolver", t => {
  [
    ["file:///src/deno/index.js", "./other.js", "/src/deno/other.js"],
    ["file:///src/deno/index.js", "../other.js", "/src/other.js"]
  ].forEach(([base, path, exp]) => {
    t.run(`${base} + ${path}`, () => {
      const u = pathResolver({ url: base, main: false })(path);
      assertEquals(u, exp);
    });
  });
});
runIfMain(import.meta);
