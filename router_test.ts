// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import {
  assertEquals,
  assertThrowsAsync,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { assertRoutingError, makeGet } from "./_test_util.ts";
import { Loglevel, setLevel } from "./logger.ts";
import { writeResponse } from "./serveio.ts";
import { createRouter, Router } from "./router.ts";
import { ServerRequest } from "./server.ts";
import { createRecorder } from "./testing.ts";
import { RoutingError } from "./error.ts";

setLevel(Loglevel.NONE);

Deno.test("router", async (t) => {
  const router = createRouter();
  const get = makeGet(router);
  (() => {
    router.handle("/index", async (req) => {
      await req.respond({
        status: 200,
        body: "ok",
      });
    });
    router.handle("/Index", async (req) => {
      await req.respond({ status: 200, body: "ok" });
    });
    router.handle(new RegExp("^/Var"), async (req) => {
      await req.respond({ status: 200, body: req.url });
    });
    router.handle(new RegExp("^/foo/(?<id>.+)"), async (req) => {
      const { id } = req.match.groups!;
      await req.respond({
        status: 200,
        headers: new Headers({
          "content-type": "application/json",
        }),
        body: JSON.stringify({ id }),
      });
    });
    router.handle("/redirect", (req) => req.redirect("/index"));
    router.handle("/respond-raw", async (req) => {
      req.event.respondWith(new Response("ok"));
      req.markAsResponded(200);
    });
  })();
  await t.step("should respond string path", async () => {
    {
      const res1 = await get("/index");
      const text = await res1.text();
      assertEquals(res1.status, 200);
      assertEquals(text, "ok");
    }
  });
  await t.step("should respond with capitalized path", async () => {
    const res1 = await get("/Index");
    const text = await res1.text();
    assertEquals(res1.status, 200);
    assertEquals(text, "ok");
  });
  await t.step("should respond with capitalized path in regex", async () => {
    for (const p of ["var", "Var"]) {
      const res1 = await get("/" + p);
      const text = await res1.text();
      assertEquals(res1.status, 200);
      assertEquals(text, text);
    }
  });
  await t.step("should respond regexp path", async () => {
    const res2 = await get("/foo/123");
    const json = await res2.json();
    assertEquals(res2.status, 200);
    assertEquals(res2.headers.get("content-type"), "application/json");
    assertEquals(json["id"], "123");
  });
  await t.step("should redirect", async () => {
    const res = await get("/redirect");
    assertEquals(res.status, 302);
    assertEquals(res.headers.get("location"), "/index");
  });
  await t.step(
    "should not go global error handler when markResponded called",
    async () => {
      const res = await get("/respond-raw");
      assertEquals(res.status, 200);
      assertEquals(await res.text(), "ok");
    },
  );
});

Deno.test("method routes", async (t) => {
  const handler = (req: ServerRequest) => {
    return req.respond({ status: 200, body: req.method });
  };
  const methods = ["GET", "POST", "PUT", "DELETE"];
  const assertMethods = async (router: Router, method: string) => {
    for (const _method of methods) {
      const rec = createRecorder({ url: "/", method: _method });
      if (_method === method) {
        await router.handleRoute("", rec);
        const resp = await rec.response();
        assertEquals(resp.status, 200);
        assertEquals(await resp.text(), method);
      } else {
        await assertThrowsAsync(async () => {
          await router.handleRoute("", rec);
        }, RoutingError);
      }
    }
  };
  let router: Router;
  function setupEach() {
    router = createRouter();
  }
  await t.step("GET", async () => {
    setupEach();
    router.get("/", handler);
    await assertMethods(router, "GET");
  });
  await t.step("POST", async () => {
    setupEach();
    router.post("/", handler);
    await assertMethods(router, "POST");
  });
  await t.step("PUT", async () => {
    setupEach();
    router.put("/", handler);
    await assertMethods(router, "PUT");
  });
  await t.step("DELETE", async () => {
    setupEach();
    router.delete("/", handler);
    await assertMethods(router, "DELETE");
  });
  await t.step("OPTIONS", async () => {
    setupEach();
    router.options("/", handler);
    await assertMethods(router, "OPTIONS");
  });
});

Deno.test("same path routes", async (t) => {
  await t.step("/", async () => {
    const router = createRouter();
    router.get("/", (req) => {
      req.respond({ status: 200, body: "get /" });
    });
    router.post("/", (req) => {
      req.respond({ status: 200, body: "post /" });
    });
    let resp = await makeGet(router)("/");
    assertEquals(await resp.text(), "get /");
    resp = await makeGet(router, "POST")("/");
    assertEquals(await resp.text(), "post /");
  });
});

Deno.test("router error", async (t) => {
  await t.step(
    "should throw RoutingError if handler won't respond",
    async () => {
      const router = createRouter();
      router.handle("/", () => {});
      await assertRoutingError(() => makeGet(router)("/"), 404);
    },
  );
  await t.step(
    "should throw RoutingError when no route is matched",
    async () => {
      const router = createRouter();
      router.handle("/", () => {});
      await assertRoutingError(() => makeGet(router)("/about"), 404);
    },
  );
  await t.step("should call error handler", async () => {
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
    assertEquals(await resp.text(), "err");
    assertEquals(handled, true);
  });
  await t.step(
    "should re-throw error if error handler won't respond",
    async () => {
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
    },
  );
  await t.step("should call final handler", async () => {
    const router = createRouter();
    router.get("/", (req) => {
      req.respond({ status: 200, body: "ok" });
    });
    let handled = false;
    router.finally((req) => {
      handled = true;
    });
    const resp = await makeGet(router)("/");
    assertEquals(resp.status, 200);
    assertEquals(await resp.text(), "ok");
    assertEquals(handled, true);
  });
});

Deno.test("router nested", async (t) => {
  const handler = (name: string, subpath: string) => (req: ServerRequest) => {
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
  await t.step("basic", async () => {
    const res = await get("/");
    assertEquals(await res.text(), "IndexRoute /");
  });
  await t.step("nested root", async () => {
    const res = await get("/users");
    assertEquals(await res.text(), "UserRoute /");
  });
  await t.step("nested root with /", async () => {
    const res = await get("/users/");
    assertEquals(await res.text(), "UserRoute /");
  });
  await t.step("nested subpath", async () => {
    const res = await get("/users/list");
    assertEquals(await res.text(), "UserRoute /list");
  });
  await t.step("nested subroutes", async () => {
    const res = await get("/users/posts");
    assertEquals(await res.text(), "PostRoute /");
  });
  await t.step("nested subroutes with /", async () => {
    const res = await get("/users/posts/");
    assertEquals(await res.text(), "PostRoute /");
  });
  await t.step("nested subroutes", async () => {
    const res = await get("/users/posts/inbox");
    assertEquals(await res.text(), "PostRoute /inbox");
  });
});

Deno.test("nested router bad", async (t) => {
  await t.step("prefix with /", async () => {
    const app = createRouter();
    const UserRoute = createRouter();
    UserRoute.get(
      "/",
      (req) => req.respond({ status: 200, body: "UserRoute /" }),
    );
    app.route("/users/", UserRoute);
    const get = makeGet(app);
    assertRoutingError(() => get("/users"), 404);
    const resp = await get("/users/");
    assertEquals(resp.status, 200);
  });
  await t.step("prefix with / and ''", async () => {
    const app = createRouter();
    const UserRoute = createRouter();
    UserRoute.get(
      "",
      (req) => req.respond({ status: 200, body: "UserRoute /" }),
    );
    app.route("/users/", UserRoute);
    const get = makeGet(app);
    await assertRoutingError(() => get("/users"), 404);
    await assertRoutingError(() => get("/users/"), 404);
  });
  await t.step("prefix with ''", () => {
    const app = createRouter();
    const UserRoute = createRouter();
    UserRoute.get(
      "/",
      (req) => req.respond({ status: 200, body: "UserRoute /" }),
    );
    app.route("", UserRoute);
    const get = makeGet(app);
    assertRoutingError(() => get("/users/"), 404);
  });
});
