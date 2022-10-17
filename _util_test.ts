// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { pathResolver } from "./_util.ts";

Deno.test("pathResolver", async (t) => {
  await Promise.all([
    ["file:///src/deno/index.js", "./other.js", "/src/deno/other.js"],
    ["file:///src/deno/index.js", "../other.js", "/src/other.js"],
  ].map(([base, path, exp]) => {
    return t.step(`${base} + ${path}`, () => {
      const u = pathResolver({
        url: base,
        main: false,
        resolve(): string {
          throw new Error("Function not implemented.");
        },
      })(path);
      assertEquals(u, exp);
    });
  }));
});
