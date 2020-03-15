// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { createApp, App } from "./app.ts";
import {
  assertEquals,
  assertMatch
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { it } from "./test_util.ts";
import { Loglevel, setLevel } from "./logger.ts";
import { writeResponse } from "./serveio.ts";
import { connectWebSocket } from "./vendor/https/deno.land/std/ws/mod.ts";
setLevel(Loglevel.NONE);

it("router", t => {
  let errorHandled = false;
  t.beforeAfterAll(() => {
    const router = createApp();
    router.handle("/index", async req => {
      await req.respond({
        status: 200,
        body: "ok"
      });
    });
    router.handle("/Index", async req => {
      await req.respond({ status: 200, body: "ok" });
    });
    router.handle(new RegExp("^/Var"), async req => {
      await req.respond({ status: 200, body: req.url });
    });
    router.handle(new RegExp("/foo/(?<id>.+)"), async req => {
      const { id } = req.match.groups!;
      await req.respond({
        status: 200,
        headers: new Headers({
          "content-type": "application/json"
        }),
        body: JSON.stringify({ id })
      });
    });
    router.handle("/no-response", async req => {});
    router.handle("/throw", async req => {
      throw new Error("throw");
    });
    router.handle("/redirect", req => req.redirect("/index"));
    router.handle("/respond-raw", async req => {
      await writeResponse(req.bufWriter, { status: 200, body: "ok" });
      req.markAsResponded(200);
    });
    router.handleError((e, req) => {
      errorHandled = true;
    });
    const listener = router.listen({
      hostname: "127.0.0.1",
      port: 8898
    });
    return () => listener.close();
  });
  t.run("should respond string path", async () => {
    {
      const res1 = await fetch("http://127.0.0.1:8898/index");
      const text = await res1.body.text();
      assertEquals(res1.status, 200);
      assertEquals(text, "ok");
    }
  });
  t.run("should respond with capitalized path", async () => {
    const res1 = await fetch("http://127.0.0.1:8898/Index");
    const text = await res1.body.text();
    assertEquals(res1.status, 200);
    assertEquals(text, "ok");
  });
  t.run("should respond with capitalized path in regex", async () => {
    for (const p of ["var", "Var"]) {
      const res1 = await fetch("http://127.0.0.1:8898/" + p);
      const text = await res1.body.text();
      assertEquals(res1.status, 200);
      assertEquals(text, text);
    }
  });
  t.run("should respond regexp path", async () => {
    const res2 = await fetch("http://127.0.0.1:8898/foo/123");
    const json = await res2.body.json();
    assertEquals(res2.status, 200);
    assertEquals(res2.headers.get("content-type"), "application/json");
    assertEquals(json["id"], "123");
  });
  t.run("should respond even if req.respond wasn't called", async () => {
    const res = await fetch("http://127.0.0.1:8898/no-response");
    // assertEquals(res.status, 404);
    const text = await res.body.text();
    assertEquals(text, "Not Found");
  });
  t.run("should respond for unknown path", async () => {
    const res = await fetch("http://127.0.0.1:8898/not-found");
    const text = await res.body.text();
    assertEquals(res.status, 404);
    assertEquals(text, "Not Found");
  });
  t.run("should handle global error", async () => {
    const res = await fetch("http://127.0.0.1:8898/throw");
    const text = await res.body.text();
    assertEquals(res.status, 500);
    assertMatch(text, /Error: throw/);
    assertEquals(errorHandled, true);
  });
  t.run("should redirect", async () => {
    const res = await fetch("http://127.0.0.1:8898/redirect");
    assertEquals(res.status, 200);
    assertEquals(await res.body.text(), "ok");
  });
  t.run(
    "should not go global error handler when markResponded called",
    async () => {
      const res = await fetch("http://127.0.0.1:8898/respond-raw");
      assertEquals(res.status, 200);
      assertEquals(await res.body?.text(), "ok");
    }
  );
});

it("router/ws", t => {
  t.beforeAfterAll(() => {
    const router = createApp();
    router.ws("/ws", async sock => {
      await sock.send("Hello");
      await sock.close(1000);
    });
    const l = router.listen({ port: 8899 });
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
