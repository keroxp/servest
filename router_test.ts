import { it } from "./test_util.ts";
import { createRouter } from "./router.ts";
import { createRecorder } from "./testing.ts";
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";

it("router", t => {
  t.run("nested router", async () => {
    const parent = createRouter();
    parent.get("/", req => {
      req.respond({ status: 200, body: "/" });
    });
    const users = createRouter();
    users.get("/", req => {
      req.respond({ status: 200, body: "/users/" });
    });
    users.get("/list", req => {
      req.respond({ status: 200, body: "/users/list" });

    })
    parent.handle("/users", users);
    const assertBody = async (url: string, body: string) => {
      let rec = createRecorder({ url });
      await parent(rec);
      let resp = await rec.response();
      assertEquals(await resp.body?.text(), body);
    };
    await assertBody("/", "/");
    await assertBody("/users", "/users/");
    await assertBody("/users/", "/users/");
    await assertBody("/users/list", "/users/list")
  });
});
