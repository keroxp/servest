// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { runIfMain, test } from "./vendor/https/deno.land/std/testing/mod.ts";
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { resolveFilepath } from "./serve_static.ts";

test("resolveFilepath", async () => {
  for (const [dir, fp, exp] of [
    [".", "/README.md", "README.md"],
    ["./site/public", "/", "site/public/index.html"],
    ["./site/public", "/index", "site/public/index.html"],
    ["./site/public", "/index.html", "site/public/index.html"],
    ["./site/public", "./nofile", undefined]
  ]) {
    assertEquals(await resolveFilepath(dir, fp), exp);
  }
});

runIfMain(import.meta);
