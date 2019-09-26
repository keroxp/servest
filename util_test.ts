// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { test, runIfMain } from "./vendor/https/deno.land/std/testing/mod.ts";
import {
  assertEquals,
  assertThrows
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { dateToDateHeader, parseAddr } from "./util.ts";

test("dateToDateHeader", function() {
  const res = dateToDateHeader(new Date("2019-09-15T08:20:15Z"));
  assertEquals(res, "Sun, 15 Sep 2019 08:20:15 GMT");
});
test("parseAddr", function() {
  let [host, port] = parseAddr(":80");
  assertEquals(host, undefined);
  assertEquals(port, 80);
  [host, port] = parseAddr("localhost:80");
  assertEquals(host, "localhost");
  assertEquals(port, 80);
  assertThrows(
    () => {
      parseAddr("");
    },
    Error,
    "invalid"
  );
  assertThrows(
    () => {
      parseAddr(":xx");
    },
    Error,
    "invalid"
  );
  assertThrows(
    () => {
      parseAddr("localhost:");
    },
    Error,
    "invalid"
  );
  assertThrows(
    () => {
      parseAddr(":");
    },
    Error,
    "invalid"
  );
});
runIfMain(import.meta);
