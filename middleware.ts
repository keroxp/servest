// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { HttpHandler } from "./router.ts";
import { RoutingError } from "./error.ts";
import { Sha1 } from "./vendor/https/deno.land/std/ws/sha1.ts";
import { assert } from "./vendor/https/deno.land/std/testing/asserts.ts";

/** Deny request with 404 if method doesn't match */
export const methodFilter = (...method: string[]): HttpHandler =>
  async req => {
    if (!method.includes(req.method)) {
      throw new RoutingError(404, `Cannot ${req.method} ${req.path}`);
    }
  };

/** Deny requests with 400 if content-type doesn't match */
export const contentTypeFilter = (
  ...types: (string | RegExp)[]
): HttpHandler =>
  async req => {
    if (types.some(v => req.headers.get("content-type")?.match(v))) {
      return;
    }
    throw new RoutingError(400, `Invalid content type`);
  };

function timeSafeCompare(secret: string, other: string): boolean {
  const a = new Sha1();
  const b = new Sha1();
  a.update(secret);
  b.update(other);
  return a.toString() === b.toString();
}

/** Basic Auth middleware */
export function basicAuth({ username, password, message }: {
  username: string;
  password: string;
  message?: string;
}): HttpHandler {
  assert(username, "username must be defined and not be empty");
  assert(password, "password must be defined and not be ampty");
  //  WWW-Authenticate: Basic realm="SECRET AREA"
  return function basicAuth(req) {
    const authorization = req.headers.get("authorization");
    if (!authorization) {
      return req.respond({
        status: 401,
        headers: new Headers({
          "www-authenticate": 'Basic realm="RECRET AREA"'
        }),
        body: message ?? "Authentication Required"
      });
    } else {
      const unauthorized = () =>
        req.respond({ status: 401, body: "Unauthorized" });
      let m = authorization.match(/^Basic (.+?)$/);
      if (!m) {
        return unauthorized();
      }
      const [u, p] = atob(m[1]).split(":");
      if (u == null || p == null) {
        return unauthorized();
      }
      if (!timeSafeCompare(username, u) || !timeSafeCompare(password, p)) {
        return unauthorized();
      }
    }
  };
}
