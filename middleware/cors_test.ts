import { group } from "../_test_util.ts";
import { createRecorder } from "../testing.ts";
import { cors } from "./cors.ts";
import { assertEquals } from "../vendor/https/deno.land/std/testing/asserts.ts";
group("cors", (t) => {
  t.test("basic", async () => {
    const r = createRecorder({
      method: "OPTIONS",
      headers: new Headers({
        "origin": "https://servestjs.org",
        "access-control-request-methods": "GET,HEAD,POST",
        "access-control-request-headers": "x-servest-version",
      }),
    });
    const m = cors({
      origin: "https://servestjs.org",
      methods: ["GET", "HEAD"],
      allowedHeaders: ["x-servest-version", "x-deno-version"],
      exposedHeaders: ["x-node-version"],
      credentials: true,
      maxAge: 100,
    });
    await m(r);
    const resp = await r.response();
    assertEquals(resp.status, 204);
    assertEquals(
      resp.headers.get("access-control-allow-origin"),
      "https://servestjs.org",
    );
    assertEquals(
      resp.headers.get("access-control-allow-methods"),
      "GET, HEAD",
    );
    assertEquals(
      resp.headers.get("access-control-allow-headers"),
      "x-servest-version",
    );
    assertEquals(
      resp.headers.get("access-control-allow-credentials"),
      "true",
    );
    assertEquals(
      resp.headers.get("access-control-max-age"),
      "100",
    );
  });
  t.test("shouldn't respond if method is not OPTIONS", () => {
    const m = cors({ origin: "*" });
    const r = createRecorder();
    m(r);
    assertEquals(r.isResponded(), false);
    assertEquals(r.responseHeaders.has("access-control-allow-origin"), false);
  });
  t.test("shouldn't respond if origin isn't sent", async () => {
    const m = cors({ origin: "*" });
    const r = createRecorder({ method: "OPTIONS" });
    m(r);
    assertEquals(r.isResponded(), false);
    assertEquals(r.responseHeaders.has("access-control-allow-origin"), false);
  });
  t.test("shouldn't allow if origin is not verified", async () => {
    const m = cors({ origin: "https://servestjs.org" });
    const r = createRecorder({
      method: "OPTIONS",
      headers: new Headers({
        "origin": "https://deno.land",
      }),
    });
    m(r);
    assertEquals(r.isResponded(), false);
    assertEquals(r.responseHeaders.has("access-control-allow-origin"), false);
  });
  t.test("wildcard", async () => {
    const m = cors({ origin: "*" });
    const r = createRecorder({
      method: "OPTIONS",
      headers: new Headers({
        "origin": "https://servestjs.org",
      }),
    });
    await m(r);
    assertEquals(r.respondedStatus(), 204);
    assertEquals(r.responseHeaders.get("access-control-allow-origin"), "*");
  });
  t.test("verifiers", async () => {
    for (
      const origin of [
        "https://servestjs.org",
        /servestjs.org/,
        (f: string) => {
          return f === "https://servestjs.org";
        },
        ["https://deno.land", "https://servestjs.org"],
      ]
    ) {
      const m = cors({ origin });
      const r = createRecorder({
        method: "OPTIONS",
        headers: new Headers({
          "origin": "https://servestjs.org",
        }),
      });
      await m(r);
      assertEquals(r.respondedStatus(), 204);
      assertEquals(
        r.responseHeaders.get("access-control-allow-origin"),
        "https://servestjs.org",
      );
    }
  });
});
