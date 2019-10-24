#!/usr/bin/env deno -A
import { runTestModules } from "./vendor/https/deno.land/std/testing/runner.ts";

runTestModules({
  include: ["*_test.ts"]
}).finally(() => {
  Deno.exit(0);
});
