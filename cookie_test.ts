// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import {
  assert,
  assertEquals,
  assertThrows,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { group } from "./_test_util.ts";
import { cookieToString, parseCookie, parseSetCookie } from "./cookie.ts";
import { toIMF } from "./vendor/https/deno.land/std/datetime/mod.ts";
import { createApp } from "./app.ts";

group("parseCookie", ({ test }) => {
  test("basic", () => {
    const cookie = parseCookie(
      `deno=land; foo=var; ${encodeURIComponent("👉=🦕")}`,
    );
    assertEquals(cookie.get("deno"), "land");
    assertEquals(cookie.get("foo"), "var");
    assertEquals(cookie.get("👉"), "🦕");
  });
});
group("parseSetCookie", ({ test }) => {
  const expires = new Date();
  const maxAge = 1000;
  const domain = "servestjs.org";
  const path = "/path";
  const sameSite = "Lax";
  test("basic", () => {
    const e = `deno=land; Expires=${
      toIMF(
        expires,
      )
    }; Max-Age=${maxAge}; Domain=${domain}; Path=${path}; Secure; HttpOnly; SameSite=${sameSite}`;
    const { name, value, ...opts } = parseSetCookie(e);
    assertEquals(name, "deno");
    assertEquals(value, "land");
    assertEquals(opts.expires!.toDateString(), expires.toDateString());
    assertEquals(opts.maxAge, maxAge);
    assertEquals(opts.domain, domain);
    assertEquals(opts.path, path);
    assertEquals(opts.secure, true);
    assertEquals(opts.httpOnly, true);
    assertEquals(opts.sameSite, sameSite);
  });
});
group("cookieToString", ({ test }) => {
  test("basic", () => {
    const expires = new Date();
    const maxAge = 1000;
    const domain = "servestjs.org";
    const path = "/path";
    const sameSite = "Lax";
    const cookie = cookieToString("deno", "land", {
      maxAge,
      expires,
      domain,
      path,
      sameSite,
      secure: true,
      httpOnly: true,
    });
    assertEquals(
      cookie,
      `deno=land; Expires=${
        toIMF(
          expires,
        )
      }; Max-Age=${maxAge}; Domain=${domain}; Path=${path}; Secure; HttpOnly; SameSite=${sameSite}`,
    );
  });
  test("should throw if maxAge is not integer", () => {
    assertThrows(() =>
      cookieToString("deno", "land", {
        maxAge: 1.11,
      })
    );
  });
  test("should throw if maxAge is lesser than or equals 0", () => {
    assertThrows(() => {
      cookieToString("deno", "land", {
        maxAge: -1,
      });
    });
  });
});

group(
  {
    name: "cookie integration",
  },
  ({ setupAll, test }) => {
    const now = new Date();
    now.setMilliseconds(0);
    setupAll(() => {
      const router = createApp();
      router.get("/", (req) => {
        req.setCookie("deno", "land", {
          path: "/",
          maxAge: 1000,
          expires: now,
        });
        return req.respond({
          status: 200,
          body: "ok",
          headers: new Headers({
            Connection: "close",
          }),
        });
      });
      router.get("/deno", (req) => {
        const deno = req.cookies.get("deno");
        return req.respond({
          status: 200,
          body: deno || "",
          headers: new Headers({
            Connection: "close",
          }),
        });
      });
      const lis = router.listen({ port: 9983 });
      return () => lis.close();
    });
    test("basic", async () => {
      const resp = await fetch("http://127.0.0.1:9983/");
      const sc = resp.headers.get("Set-Cookie");
      assert(sc != null, "should set cookie");
      const cookie = parseSetCookie(sc);
      await resp.text();
      assertEquals(cookie, {
        name: "deno",
        value: "land",
        path: "/",
        maxAge: 1000,
        expires: now,
        sameSite: undefined,
        domain: undefined,
        secure: undefined,
        httpOnly: undefined,
      });
      const resp2 = await fetch("http://127.0.0.1:9983/deno", {
        headers: {
          Cookie: "deno=land",
        },
      });
      const body = await resp2.text();
      assertEquals(body, "land");
    });
  },
);
