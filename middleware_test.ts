// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { basicAuth } from "./middleware.ts";
import { group } from "./test_util.ts";
import {
  assertEquals,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { createRecorder } from "./testing.ts";
group("middleware", ({ test }) => {
  test("basicAuth", async () => {
    const auth = basicAuth({
      username: "deno",
      password: "land",
      message: "hello",
    });
    let req = createRecorder({
      url: "/",
      method: "GET",
    });
    await auth(req);
    let resp = await req.response();
    assertEquals(resp.status, 401);
    assertEquals(resp.headers.has("www-authenticate"), true);
    assertEquals(await resp.text(), "hello");
    const up = btoa("deno:land");
    req = createRecorder({
      url: "/",
      method: "GET",
      headers: new Headers({
        "authorization": `Basic ${up}`,
      }),
    });
    await auth(req);
    assertEquals(req.isResponded(), false);
  });
  test("basicAuth failed", async () => {
    const patterns = [
      "Basic hoge",
      `Basic ${btoa("deno:js")}`,
      `Basic ${btoa("deno:")}`,
      "Basic",
    ];
    const auth = basicAuth({
      username: "deno",
      password: "land",
      message: "hello",
    });
    for (const pat of patterns) {
      let req = createRecorder({
        url: "/",
        method: "GET",
        headers: new Headers({
          "authorization": pat,
        }),
      });
      await auth(req);
      assertEquals(req.isResponded(), true);
      const resp = await req.response();
      assertEquals(resp.status, 401);
    }
  });
});
