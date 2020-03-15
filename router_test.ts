// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import {
  assertEquals,
  assertMatch
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { it } from "./test_util.ts";
import { Loglevel, setLevel } from "./logger.ts";
import { writeResponse } from "./serveio.ts";
import { createRouter } from "./router.ts";
import { createRecorder } from "./testing.ts";
setLevel(Loglevel.NONE);

it("router", t => {
  let errorHandled = false;
  const router = createRouter();
  t.beforeAfterAll(() => {
    router.route("/index", async req => {
      await req.respond({
        status: 200,
        body: "ok"
      });
    });
    router.route("/Index", async req => {
      await req.respond({ status: 200, body: "ok" });
    });
    router.route(new RegExp("^/Var"), async req => {
      await req.respond({ status: 200, body: req.url });
    });
    router.route(new RegExp("/foo/(?<id>.+)"), async req => {
      const { id } = req.match.groups!;
      await req.respond({
        status: 200,
        headers: new Headers({
          "content-type": "application/json"
        }),
        body: JSON.stringify({ id })
      });
    });
    router.route("/no-response", async req => {});
    router.route("/throw", async req => {
      throw new Error("throw");
    });
    router.route("/redirect", req => req.redirect("/index"));
    router.route("/respond-raw", async req => {
      await writeResponse(req.bufWriter, { status: 200, body: "ok" });
      req.markAsResponded(200);
    });
    router.catch((e, req) => {
      errorHandled = true;
    });
    return () => {};
  });
  async function get(url: string) {
    const rec = createRecorder({ method: "GET", url });
    await router.handle(rec);
    return rec.response();
  }
  t.run("should respond string path", async () => {
    {
      const res1 = await get("/index");
      const text = await res1.body.text();
      assertEquals(res1.status, 200);
      assertEquals(text, "ok");
    }
  });
  t.run("should respond with capitalized path", async () => {
    const res1 = await get("/Index");
    const text = await res1.body.text();
    assertEquals(res1.status, 200);
    assertEquals(text, "ok");
  });
  t.run("should respond with capitalized path in regex", async () => {
    for (const p of ["var", "Var"]) {
      const res1 = await get("/" + p);
      const text = await res1.body.text();
      assertEquals(res1.status, 200);
      assertEquals(text, text);
    }
  });
  t.run("should respond regexp path", async () => {
    const res2 = await get("/foo/123");
    const json = await res2.body.json();
    assertEquals(res2.status, 200);
    assertEquals(res2.headers.get("content-type"), "application/json");
    assertEquals(json["id"], "123");
  });
  t.run("should respond even if req.respond wasn't called", async () => {
    const res = await get("/no-response");
    // assertEquals(res.status, 404);
    const text = await res.body.text();
    assertEquals(text, "Not Found");
  });
  t.run("should respond for unknown path", async () => {
    const res = await get("/not-found");
    const text = await res.body.text();
    assertEquals(res.status, 404);
    assertEquals(text, "Not Found");
  });
  t.run("should handle global error", async () => {
    const res = await get("/throw");
    const text = await res.body.text();
    assertEquals(res.status, 500);
    assertMatch(text, /Error: throw/);
    assertEquals(errorHandled, true);
  });
  t.run("should redirect", async () => {
    const res = await get("/redirect");
    assertEquals(res.status, 302);
    assertEquals(res.headers.get("location"), "/index");
  });
  t.run(
    "should not go global error handler when markResponded called",
    async () => {
      const res = await get("/respond-raw");
      assertEquals(res.status, 200);
      assertEquals(await res.body?.text(), "ok");
    }
  );
});

it("router nested", t => {
  const router = createRouter({ name: "IndexRoute" });
  router.get("/", req => {
    req.respond({ status: 200, body: "/" });
  });
  const users = createRouter({ name: "UserRoute" });
  users.get("/users", req => req.respond({ status: 200, body: "/users/" }));
  users.get(
    "/users/list",
    req => req.respond({ status: 200, body: "/users/list" })
  );
  router.use("/users", users);
  async function get(url: string) {
    const rec = createRecorder({ method: "GET", url });
    await router.handle(rec);
    return rec.response();
  }
  t.run("basic", async () => {
    const res = await get("/");
    assertEquals(await res.body?.text(), "/");
  });
  t.run("nested root", async () => {
    const res = await get("/users");
    assertEquals(await res.body?.text(), "/users/");
  });
  t.run("nested subpath", async () => {
    const res = await get("/users/list");
    assertEquals(await res.body?.text(), "/users/list");
  });
});
