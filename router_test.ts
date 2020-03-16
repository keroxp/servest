// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { it, makeGet, assertRoutingError } from "./test_util.ts";
import { Loglevel, setLevel } from "./logger.ts";
import { writeResponse } from "./serveio.ts";
import {
  createRouter,
} from "./router.ts";
import { ServerRequest } from "./server.ts";

setLevel(Loglevel.NONE);

it("router", t => {
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
    router.handle(new RegExp("/foo/(?<id>.+)"), async (req,params) => {
      const { id } = params.match.groups!;
      await req.respond({
        status: 200,
        headers: new Headers({
          "content-type": "application/json"
        }),
        body: JSON.stringify({ id })
      });
    });
    router.handle("/redirect", req => req.redirect("/index"));
    router.handle("/respond-raw", async req => {
      await writeResponse(req.bufWriter, { status: 200, body: "ok" });
      req.markAsResponded(200);
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

it("router error", t => {
  t.run("should throw RoutingError if handler won't respond", async () => {
    const router = createRouter();
    router.handle("/", () => {});
    await assertRoutingError(() => makeGet(router)("/"), 404);
  });
  t.run("should throw RoutingError when no route is matched", async () => {
    const router = createRouter();
    router.handle("/", () => {});
    await assertRoutingError(() => makeGet(router)("/about"), 404);
  });
  t.run("should call error handler", async () => {
    const router = createRouter();
    router.handle("/", () => {
      throw new Error("Err");
    });
    let handled = false;
    router.catch((_, req) => {
      handled = true;
      req.respond({ status: 200, body: "err" });
    });
    const resp = await makeGet(router)("/");
    assertEquals(resp.status, 200);
    assertEquals(await resp.body.text(), "err");
    assertEquals(handled, true);
  });
  t.run("should re-throw error if error handler won't respond", async () => {
    const router = createRouter();
    router.handle("/", () => {
      throw new Error("Err");
    });
    let handled = false;
    let thrown: any;
    router.catch((e) => {
      thrown = e;
      handled = true;
    });
    let reThrown: any;
    try {
      await makeGet(router)("/");
    } catch (e) {
      reThrown = e;
    }
    assertEquals(handled, true);
    assertEquals(thrown, reThrown);
  });
});

it("router nested", t => {
  const handler = (name: string, subpath: string) =>
    (req: ServerRequest) => {
      req.respond({ status: 200, body: `${name} ${subpath}` });
    };
  const PostRoute = () => {
    const route = createRouter();
    route.get("/", handler("PostRoute", "/"));
    route.get("/inbox", handler("PostRoute", "/inbox"));
    return route;
  };
  const UserRoutes = () => {
    const users = createRouter();
    users.get("/", handler("UserRoute", "/"));
    users.get("/list", handler("UserRoute", "/list"));
    users.route("/posts", PostRoute());
    return users;
  };
  const app = createRouter();
  app.get("/", handler("IndexRoute", "/"));
  app.route("/users", UserRoutes());
  const get = makeGet(app);
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
    const app = createRouter();
    const UserRoute = createRouter();
    UserRoute.get(
      "/",
      req => req.respond({ status: 200, body: "UserRoute /" })
    );
    app.route("/users/", UserRoute);
    const get = makeGet(app);
    assertRoutingError(() => get("/users"), 404);
    const resp = await get("/users/");
    assertEquals(resp.status, 200);
  });
  t.run("prefix with / and ''", async () => {
    const app = createRouter();
    const UserRoute = createRouter();
    UserRoute.get(
      "",
      req => req.respond({ status: 200, body: "UserRoute /" })
    );
    app.route("/users/", UserRoute);
    const get = makeGet(app);
    await assertRoutingError(() => get("/users"), 404);
    await assertRoutingError(() => get("/users/"), 404);
  });
  t.run("prefix with ''", async () => {
    const app = createRouter();
    const UserRoute = createRouter();
    UserRoute.get(
      "/",
      req => req.respond({ status: 200, body: "UserRoute /" })
    );
    app.route("", UserRoute);
    const get = makeGet(app);
    assertRoutingError(() => get("/users/"), 404);
  });
});
