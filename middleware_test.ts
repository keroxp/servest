import { methodFilter } from "./middleware.ts";
import { it } from "./test_util.ts";
import {
  assertEquals,
  assertThrowsAsync
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { runIfMain } from "./vendor/https/deno.land/std/testing/mod.ts";
import { createRecorder } from "./testing.ts";
import { RoutingError } from "./error.ts";
it("middleware", t => {
  t.run("basic", async () => {
    const filter = methodFilter("POST");
    const req = createRecorder({
      url: "/",
      method: "GET"
    });
    await assertThrowsAsync(async () => {
      await filter(req);
    }, RoutingError);
  });
});
runIfMain(import.meta);
