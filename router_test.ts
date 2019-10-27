// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { createRouter } from "./router.ts";
import { runIfMain } from "./vendor/https/deno.land/std/testing/mod.ts";
import {
  assertEquals,
  assertMatch
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { it } from "./test_util.ts";
import { Loglevel, setLevel } from "./logger.ts";
setLevel(Loglevel.NONE);

it("router", t => {
  let errorHandled = false;
  t.beforeAfterAll(() => {
    const router = createRouter();
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
      const { id } = req.match.groups;
      await req.respond({
        status: 200,
        headers: new Headers({
          "content-type": "application/json"
        }),
        body: JSON.stringify({ id })
      });
    });
    router.handle("/params/:param", async req => {
      const { param } = req.match.groups;
      await req.respond({
        status: 200,
        headers: new Headers({
          "content-type": "application/json"
        }),
        body: JSON.stringify({ param })
      });
    });
    router.handle("/params/:param1/:param2", async req => {
      const { param1, param2 } = req.match.groups;
      await req.respond({
        status: 200,
        headers: new Headers({
          "content-type": "application/json"
        }),
        body: JSON.stringify({ param1, param2 })
      });
    });
    router.handle("/no-response", async req => {});
    router.handle("/throw", async req => {
      throw new Error("throw");
    });
    router.handle("/redirect", req => req.redirect("/index"));
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
  t.run("should respond :param", async () => {
    const res2 = await fetch("http://127.0.0.1:8898/params/p1");
    const json = await res2.body.json();
    assertEquals(res2.status, 200);
    assertEquals(res2.headers.get("content-type"), "application/json");
    assertEquals(json["param"], "p1");
  });
  t.run("should respond :param1 and :param2", async () => {
    const res2 = await fetch("http://127.0.0.1:8898/params/p1/p2");
    const json = await res2.body.json();
    assertEquals(res2.status, 200);
    assertEquals(res2.headers.get("content-type"), "application/json");
    assertEquals(json["param1"], "p1");
    assertEquals(json["param2"], "p2");
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
});
runIfMain(import.meta);
