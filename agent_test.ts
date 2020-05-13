// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { encode } from "./vendor/https/deno.land/std/encoding/utf8.ts";
import { createAgent } from "./agent.ts";
import { createApp } from "./app.ts";
import {
  assertEquals,
  assertThrows,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { group } from "./_test_util.ts";
import { ServeListener } from "./server.ts";

function setupRouter(port: number): ServeListener {
  const app = createApp();
  app.route("/get", async (req) => {
    return req.respond({
      status: 200,
      body: encode("ok"),
    });
  });
  app.route("/post", async (req) => {
    return req.respond({
      status: 200,
      headers: req.headers,
      body: req.body,
    });
  });
  return app.listen({ port });
}

group("agent", ({ test, setupAll }) => {
  let port = 8700;
  setupAll(() => {
    const listener = setupRouter(port);
    return () => listener.close();
  });
  test("basic", async () => {
    const agent = createAgent(`http://127.0.0.1:${port}`);
    try {
      {
        const res = await agent.send({
          path: "/get",
          method: "GET",
        });
        assertEquals(res.status, 200);
        assertEquals(await res.text(), "ok");
      }
      {
        const res = await agent.send({
          path: "/post",
          method: "POST",
          body: encode("denoland"),
        });
        assertEquals(res.status, 200);
        assertEquals(await res.text(), "denoland");
      }
    } finally {
      agent.conn.close();
    }
  });
  test("agentTls", async () => {
    const agent = createAgent(`https://httpbin.org`);
    try {
      {
        const res = await agent.send({
          path: "/get?deno=land",
          method: "GET",
        });
        assertEquals(res.status, 200);
        const resp = await res.json();
        assertEquals(resp["args"]["deno"], "land");
      }
      {
        const res = await agent.send({
          path: "/post",
          method: "POST",
          headers: new Headers({
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          }),
          body: "deno=land",
        });
        assertEquals(res.status, 200);
        const resp = await res.json();
        assertEquals(resp["form"]["deno"], "land");
      }
    } finally {
      agent.conn.close();
    }
  });
  test("agent unread body", async () => {
    const agent = createAgent(`http://127.0.0.1:${port}`);
    try {
      await agent.send({ path: "/get", method: "GET" });
      await agent.send({ path: "/post", method: "POST", body: encode("ko") });
      const resp = await agent.send({
        path: "/post",
        method: "POST",
        body: encode("denoland"),
      });
      assertEquals(await resp.text(), "denoland");
    } finally {
      agent.conn.close();
    }
  });
  test("agent invalid scheme", async () => {
    assertThrows(() => {
      createAgent("ftp://127.0.0.1");
    });
  });
});
