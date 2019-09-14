import { test, runIfMain } from "./vendor/https/deno.land/std/testing/mod.ts";
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { dateToDateHeader } from "./util.ts";

test("dateToDateHeader", function() {
  const res = dateToDateHeader(new Date("2019-09-15T08:20:15Z"));
  assertEquals(res, "Sun, 15 Sep 2019 08:20:15 GMT");
});

runIfMain(import.meta);
