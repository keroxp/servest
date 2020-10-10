// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { App, createApp } from "./app.ts";
import {
  assertEquals,
  assertMatch,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { group, makeGet } from "./_test_util.ts";
import { Loglevel, setLevel } from "./logger.ts";
setLevel(Loglevel.NONE);

group({
  name: "app",
}, ({ setupAll, test }) => {
  const app = createApp();
  app.handle("/no-response", () => {});
  app.handle("/throw", () => {
    throw new Error("throw");
  });
  const get = makeGet(app);
  setupAll(() => {
    const l = app.listen({ port: 8899 });
    return () => l.close();
  });
  test("should respond if req.respond wasn't called", async () => {
    const res = await get("/no-response");
    assertEquals(res.status, 404);
  });
  test("should respond for unknown path", async () => {
    const res = await get("/not-found");
    assertEquals(res.status, 404);
  });
  test("should handle global error", async () => {
    const res = await get("/throw");
    const text = await res.text();
    assertEquals(res.status, 500);
    assertMatch(text, /Error: throw/);
  });
});
group({
  name: "app/ws",
  sanitizeResources: false,
}, ({ test, setupAll }) => {
  const app = createApp();
  app.ws("/ws", async (sock) => {
    await sock.send("Hello");
    await sock.close(1000);
  });
  setupAll(() => {
    const l = app.listen({ port: 8890 });
    return () => l.close();
  });
  test({
    name: "should accept ws",
    fn: async () => {
      const sock = new WebSocket("ws://127.0.0.1:8890/ws");
      const p1 = new Promise((resolve) => {
        sock.onmessage = (msg) => {
          resolve(msg.data);
        };
      });
      const p2 = new Promise((resolve) => {
        sock.onclose = () => {
          resolve();
        };
      });
      const [msg] = await Promise.all([p1, p2]);
      assertEquals(msg, "Hello");
      sock.close();
    },
  });
});
