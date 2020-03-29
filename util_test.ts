// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { pathResolver } from "./util.ts";
import { it } from "./test_util.ts";

it("pathResolver", (t) => {
  [
    ["file:///src/deno/index.js", "./other.js", "/src/deno/other.js"],
    ["file:///src/deno/index.js", "../other.js", "/src/other.js"],
  ].forEach(([base, path, exp]) => {
    t.run(`${base} + ${path}`, () => {
      const u = pathResolver({ url: base, main: false })(path);
      assertEquals(u, exp);
    });
  });
});
