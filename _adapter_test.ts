import { BufReader, BufWriter } from "./vendor/https/deno.land/std/io/bufio.ts";
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { classicAdapter, nativeAdapter } from "./_adapter.ts";
import { group } from "./_test_util.ts";

group("adapter", ({ test }) => {
  async function doTest() {
    const resp = await fetch("http://localhost:8899", {
      method: "POST",
      body: "hello",
    });
    assertEquals(resp.status, 200);
    assertEquals(resp.headers.get("content-type"), "text/html");
    assertEquals(await resp.text(), "hello");
  }
  test("classic", async () => {
    async function serve() {
      const l = Deno.listen({ port: 8899 });
      const conn = await l.accept();
      const bufReader = new BufReader(conn);
      const bufWriter = new BufWriter(conn);
      const adapter = classicAdapter({ conn, bufReader, bufWriter });
      const req = await adapter.next({});
      await adapter.respond({
        status: 200,
        headers: new Headers({
          "content-type": "text/html",
        }),
        body: req!.body,
      });
      adapter.close();
      l.close();
    }
    serve();
    await doTest();
  });
  test("native", async () => {
    async function serve() {
      const l = Deno.listen({ port: 8899 });
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
      adapter.close();
      l.close();
    }
    serve();
    await doTest();
  });
});
