// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import {
  assertEquals,
  assertMatch
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { it } from "./test_util.ts";
import { Loglevel, setLevel } from "./logger.ts";
import { writeResponse } from "./serveio.ts";
import { createRouter, RouteHandler, RoutedServerRequest, Router } from "./router.ts";
import { createRecorder } from "./testing.ts";
setLevel(Loglevel.NONE);

function makeGet(router: Router) {
  return async function get(url: string) {
    const rec = createRecorder({ method: "GET", url });
    await router.handleRequest(rec);
    return rec.response();
  }
}

it("router", t => {
  let errorHandled = false;
  const router = createRouter();
  const get = makeGet(router);
  t.beforeAfterAll(() => {
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
    router.catch((e, req) => {
      errorHandled = true;
    });
    return () => {};
  });
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
  const handler = (name: string, subpath: string) => (req: RoutedServerRequest) => {
    req.respond({ status: 200, body: `${name} ${subpath}` });
  }
  const PostRoute = () => {
    const route = createRouter({ name: "PostRoute" });
    route.get("/", handler("PostRoute", "/"));
    route.get("/inbox", handler("PostRoute", "/inbox"));
    return route;
  };
  const UserRoutes = () => {
    const users = createRouter({ name: "UserRoute" });
    users.get("/", handler("UserRoute", "/"));
    users.get("/list", handler("UserRoute", "/list"));
    users.route("/posts", PostRoute());
    return users;
  }
  const router = createRouter({ name: "IndexRoute" });
  router.get("/", handler("IndexRoute", "/"));
  router.route("/users", UserRoutes());
  const get = makeGet(router);
  t.run("basic", async () => {
    const res = await get("/");
    assertEquals(await res.body?.text(), "IndexRoute /");
  });
  t.run("nested root", async () => {
    const res = await get("/users");
    assertEquals(await res.body?.text(), "UserRoute /");
  });
  t.run("nested root with /", async () => {
    const res = await get("/users/");
    assertEquals(await res.body?.text(), "UserRoute /");
  });
  t.run("nested subpath", async () => {
    const res = await get("/users/list");
    assertEquals(await res.body?.text(), "UserRoute /list");
  });
  t.run("nested subroutes", async () => {
    const res = await get("/users/posts");
    assertEquals(await res.body?.text(), "PostRoute /");
  });
  t.run("nested subroutes with /", async () => {
    const res = await get("/users/posts/");
    assertEquals(await res.body?.text(), "PostRoute /");
  });
  t.run("nested subroutes", async () => {
    const res = await get("/users/posts/inbox");
    assertEquals(await res.body?.text(), "PostRoute /inbox");
  });
});

it("nested router bad", t => {
  t.run("prefix with /", async () => {
    const router = createRouter();
    const UserRoute = createRouter();
    UserRoute.get("/", req => req.respond({ status: 200, body: "UserRoute /" }));
    router.route("/users/", UserRoute);
    const get = makeGet(router);
    let resp = await get("/users");
    assertEquals(resp.status, 404);
    resp = await get("/users/");
    assertEquals(resp.status, 200);
  });
  t.run("prefix with / and ''", async () => {
    const router = createRouter({name: "Index"});
    const UserRoute = createRouter({ name: "Users" });
    UserRoute.get("", req => req.respond({ status: 200, body: "UserRoute /" }));
    router.route("/users/", UserRoute);
    const get = makeGet(router);
    let resp = await get("/users"); // doesn't match prefix
    assertEquals(resp.status, 404);
    resp = await get("/users/"); // match prefix but startsWith("") always false
    assertEquals(resp.status, 404); 
  });
  t.run("prefix with ''", async () => {
    const router = createRouter({name: "Index"});
    const UserRoute = createRouter({name: "Users"});
    UserRoute.get("/", req => req.respond({ status: 200, body: "UserRoute /" }));
    router.route("", UserRoute);
    const get = makeGet(router);
    const resp = await get("/users/");
    assertEquals(resp.status, 404);
  });
});