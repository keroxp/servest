// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { pathResolver } from "./util.ts";
import { group } from "./_test_util.ts";

group("pathResolver", (t) => {
  [
    ["file:///src/deno/index.js", "./other.js", "/src/deno/other.js"],
    ["file:///src/deno/index.js", "../other.js", "/src/other.js"],
  ].forEach(([base, path, exp]) => {
    t.test(`${base} + ${path}`, () => {
      const u = pathResolver({ url: base, main: false })(path);
      assertEquals(u, exp);
    });
  });
});
