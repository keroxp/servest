import { runIfMain, test } from "./vendor/https/deno.land/std/testing/mod.ts";
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { resolveFilepath } from "./serve_static.ts";

test("resolveFiles", async () => {
  [
    [".", "/README.md", "README.md"],
    ["./site/public", "/", "site/public/index.html"],
    ["./site/public", "/index", "site/public/index.html"],
    ["./site/public", "/index.html", "site/public/index.html"],
    ["./site/public", "./nofile", undefined]
  ].forEach(async ([dir, fp, exp]) => {
    assertEquals(await resolveFilepath(dir, fp), exp);
  });
});

runIfMain(import.meta);
