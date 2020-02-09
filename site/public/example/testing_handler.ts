// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { test } from "https://deno.land/std/testing/mod.ts";
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { HttpHandler } from "../../../router.ts";
import { createRecorder } from "../../../testing.ts";

const handleRequest: HttpHandler = async req => {
  const body = await req.body!.text();
  return req.respond({ status: 200, body: "Hello! " + body });
};

test("handler should respond with 200", async () => {
  // Create dummy request for handlers
  const recorder = createRecorder({ url: "/", method: "POST", body: "Deno" });
  await handleRequest(recorder);
  // Obtain recorded response
  const resp = await recorder.response();
  assertEquals(resp.status, 200);
  assertEquals(await resp.body.text(), "Hello! Deno");
});
