// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { nativeAdapter } from "./_adapter.ts";

Deno.test({
  name: "adapter",
  fn: async (t) => {
    async function doTest() {
      const resp = await fetch("http://localhost:8899", {
        method: "POST",
        body: "hello",
      });
      assertEquals(resp.status, 200);
      assertEquals(resp.headers.get("content-type"), "text/html");
      assertEquals(await resp.text(), "hello");
    }
    let tearDown: ()=>void
    await t.step("native", async () => {
      const l = Deno.listen({ port: 8899 });
      async function serve() {
        const conn = await l.accept();
        const adapter = nativeAdapter(conn);
        const req = await adapter.next({});
        await adapter.respond({
          status: 200,
          headers: new Headers({
            "content-type": "text/html",
          }),
          body: req!.body,
        });
        tearDown = () => {
          adapter.close()
          l.close()
        }
      }
      serve();
      await doTest();
      tearDown()
    });
  },
});
