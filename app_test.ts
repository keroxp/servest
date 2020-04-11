// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { createApp, App } from "./app.ts";
import {
  assertEquals,
  assertMatch,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { it, makeGet, assertRoutingError } from "./test_util.ts";
import { Loglevel, setLevel } from "./logger.ts";
import { connectWebSocket } from "./vendor/https/deno.land/std/ws/mod.ts";
setLevel(Loglevel.NONE);

it("app", (t) => {
  const app = createApp();
  app.handle("/no-response", () => {});
  app.handle("/throw", () => {
    throw new Error("throw");
  });
  const get = makeGet(app);
  t.beforeAfterAll(() => {
    const l = app.listen({ port: 8899 });
    return () => l.close();
  });
  t.run("should respond if req.respond wasn't called", async () => {
    const res = await get("/no-response");
    assertEquals(res.status, 404);
  });
  t.run("should respond for unknown path", async () => {
    const res = await get("/not-found");
    assertEquals(res.status, 404);
  });
  t.run("should handle global error", async () => {
    const res = await get("/throw");
    const text = await res.body.text();
    assertEquals(res.status, 500);
    assertMatch(text, /Error: throw/);
  });
});
it("app/ws", (t) => {
  const app = createApp();
  app.ws("/ws", async (sock) => {
    await sock.send("Hello");
    await sock.close(1000);
  });
  t.beforeAfterAll(() => {
    const l = app.listen({ port: 8890 });
    return () => l.close();
  });
  t.run("should accept ws", async () => {
    const sock = await connectWebSocket("ws://127.0.0.1:8890/ws");
    const it = sock.receive();
    const { value: msg1 } = await it.next();
    assertEquals(msg1, "Hello");
    const { value: msg2 } = await it.next();
    assertEquals(msg2, { code: 1000, reason: "" });
    const { done } = await it.next();
    assertEquals(done, true);
    assertEquals(sock.isClosed, true);
    sock.closeForce();
  });
});
