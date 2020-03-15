// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { createApp, App } from "./app.ts";
import {
  assertEquals
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { it } from "./test_util.ts";
import { Loglevel, setLevel } from "./logger.ts";
import { connectWebSocket } from "./vendor/https/deno.land/std/ws/mod.ts";
setLevel(Loglevel.NONE);

it("app/ws", t => {
  t.beforeAfterAll(() => {
    const app = createApp();
    app.ws("/ws", async sock => {
      await sock.send("Hello");
      await sock.close(1000);
    });
    const l = app.listen({ port: 8899 });
    return () => l.close();
  });
  t.run("should accept ws", async () => {
    const sock = await connectWebSocket("ws://127.0.0.1:8899/ws");
    const it = sock.receive();
    const { value: msg1 } = await it.next();
    assertEquals(msg1, "Hello");
    const { value: msg2 } = await it.next();
    assertEquals(msg2, { code: 1000, reason: "" });
    const { done } = await it.next();
    assertEquals(done, true);
    assertEquals(sock.isClosed, true);
  });
});
