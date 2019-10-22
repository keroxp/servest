import { test, runIfMain } from "./vendor/https/deno.land/std/testing/mod.ts";
import {
  assertEquals,
  assertThrows
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { it } from "./test_util.ts";
import { cookieToString, parseCookie, parseSetCookie } from "./cookie.ts";
import { dateToIMF } from "./util.ts";
import { createRouter } from "./router.ts";

it("parseCookie", t => {
  t.run("basic", () => {
    const cookie = parseCookie(encodeURIComponent("deno=land; foo=var; 👉=🦕"));
    assertEquals(cookie.get("deno"), "land");
    assertEquals(cookie.get("foo"), "var");
    assertEquals(cookie.get("👉"), "🦕");
  });
});
it("parseSetCookie", t => {
  const expires = new Date();
  const maxAge = 1000;
  const domain = "servestjs.org";
  const path = "/path";
  const sameSite = "Lax";
  t.run("basic", () => {
    const e = `deno=land; Expires=${dateToIMF(
      expires
    )}; Max-Age=${maxAge}; Domain=${domain}; Path=${path}; Secure; HttpOnly; SameSite=${sameSite}`;
    const { name, value, opts } = parseSetCookie(e);
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
it("cookieToString", t => {
  t.run("basic", () => {
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
      httpOnly: true
    });
    assertEquals(
      cookie,
      `deno=land; Expires=${dateToIMF(
        expires
      )}; Max-Age=${maxAge}; Domain=${domain}; Path=${path}; Secure; HttpOnly; SameSite=${sameSite}`
    );
  });
  t.run("should throw if maxAge is not integer", () => {
    assertThrows(() =>
      cookieToString("deno", "land", {
        maxAge: 1.11
      })
    );
  });
  t.run("should throw if maxAge is lesser than or equals 0", () => {
    assertThrows(() => {
      cookieToString("deno", "land", {
        maxAge: -1
      });
    });
  });
});

it("cookie integration", t => {
  t.beforeAfterAll(() => {
    const router = createRouter();
    router.get("/", req => {
      req.setCookie("deno", "land", { path: "/" });
      return req.respond({ status: 200, body: "ok" });
    });
    router.get("/deno", req => {
      const deno = req.cookies.get("deno");
      return req.respond({ status: 200, body: deno || "" });
    });
    const lis = router.listen(":9988");
    return () => lis.close();
  });
  t.run("basic", async () => {
    // const resp = await fetch("http://127.0.0.1:9988/");
    // const secCookie = resp.headers.get("Set-Cookie");
  });
});

runIfMain(import.meta);
