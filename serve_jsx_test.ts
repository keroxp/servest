import { createRecorder } from "./testing.ts";
import {
  assertEquals,
  assertMatch,
  assertThrowsAsync
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { runIfMain } from "./vendor/https/deno.land/std/testing/mod.ts";
import { serveJsx } from "./serve_jsx.ts";
import { pathResolver, readString } from "./util.ts";
import { it } from "./test_util.ts";

it("serveJsx", t => {
  const func = serveJsx(pathResolver(import.meta)("./fixtures/public"), f =>
    import(f)
  );
  t.run("basic", async () => {
    const rec = createRecorder({
      url: "/",
      method: "GET"
    });
    await func(rec);
    const resp = await rec.response();
    assertEquals(resp.status, 200);
    assertMatch(resp.headers.get("content-type"), /text\/html/);
    assertEquals(
      await readString(resp.body),
      '<html data-reactroot="">deno</html>'
    );
  });
  t.run("should throw if jsx file has no default export", async () => {
    const rec = createRecorder({ url: "/empty", method: "GET" });
    await assertThrowsAsync(
      async () => {
        await func(rec);
      },
      Error,
      "jsx: jsx/tsx files served by serveJsx must has default export!"
    );
  });
  t.run("should throw if default export is not function", async () => {
    const rec = createRecorder({ url: "/not-component", method: "GET" });
    await assertThrowsAsync(
      async () => {
        await func(rec);
      },
      Error,
      "jsx: default export must be React component!"
    );
  });
});

runIfMain(import.meta);
