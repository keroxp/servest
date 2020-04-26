// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { createRecorder, ServeHandler } from "../../../mod.ts";

const handleRequest: ServeHandler = async (req) => {
  const body = await req.text();
  return req.respond({ status: 200, body: "Hello! " + body });
};

Deno.test("handler should respond with 200", async () => {
  // Create dummy request for handlers
  const recorder = createRecorder({ url: "/", method: "POST", body: "Deno" });
  await handleRequest(recorder);
  // Obtain recorded response
  const resp = await recorder.response();
  assertEquals(resp.status, 200);
  assertEquals(await resp.text(), "Hello! Deno");
});
