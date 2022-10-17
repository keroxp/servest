// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { createRecorder } from "../testing.ts";
import { cors } from "./cors.ts";
import { assertEquals } from "../vendor/https/deno.land/std/testing/asserts.ts";
Deno.test("cors", async (t) => {
  await t.step("basic", async () => {
    const r = createRecorder({
      method: "OPTIONS",
      headers: new Headers({
        "origin": "https://servestjs.org",
        "access-control-request-method": "GET",
        "access-control-request-headers": "x-servest-version",
      }),
    });
    const m = cors({
      origin: "https://servestjs.org",
      methods: ["GET", "HEAD"],
      allowedHeaders: ["x-servest-version", "x-deno-version"],
      exposedHeaders: ["x-node-version"],
      withCredentials: true,
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
      "GET",
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

  await t.step("shouldn't respond if method is not OPTIONS", () => {
    const m = cors({ origin: "*" });
    const r = createRecorder();
    m(r);
    assertEquals(r.isResponded(), false);
    assertEquals(r.responseHeaders.has("access-control-allow-origin"), false);
  });

  await t.step("shouldn't respond if origin isn't sent", () => {
    const m = cors({ origin: "*" });
    const r = createRecorder({ method: "OPTIONS" });
    m(r);
    assertEquals(r.isResponded(), false);
    assertEquals(r.responseHeaders.has("access-control-allow-origin"), false);
  });

  await t.step("shouldn't allow if origin is not verified", () => {
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

  await t.step("wildcard", async () => {
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

  await t.step("verifiers", async () => {
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

  await t.step(
    "Should respond the correct access-control-allow-origin header on other methods",
    async () => {
      const m = cors({ origin: "*" });
      const r = createRecorder({
        method: "POST",
        headers: new Headers({
          "origin": "https://servestjs.org",
        }),
      });
      await m(r);
      assertEquals(r.responseHeaders.get("access-control-allow-origin"), "*");
    },
  );

  await t.step(
    "Should respond the correct access-control-expose-headers header on other methods",
    async () => {
      const m = cors({
        origin: "*",
        exposedHeaders: ["x-node-version"],
      });
      const r = createRecorder({
        method: "POST",
        headers: new Headers({
          "origin": "https://servestjs.org",
        }),
      });
      await m(r);
      assertEquals(
        r.responseHeaders.get("access-control-expose-headers"),
        "x-node-version",
      );
    },
  );
});
