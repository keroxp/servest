// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { RoutingError } from "./error.ts";
import { Sha1 } from "./vendor/https/deno.land/std/hash/sha1.ts";
import { assert } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { ServeHandler } from "./server.ts";

/** Deny requests with 400 if content-type doesn't match */
export const contentTypeFilter = (
  ...types: (string | RegExp)[]
): ServeHandler =>
  async (req) => {
    if (types.some((v) => req.headers.get("content-type")?.match(v))) {
      return;
    }
    throw new RoutingError(400);
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
}): ServeHandler {
  assert(username, "username must be defined and not be empty");
  assert(password, "password must be defined and not be ampty");
  //  WWW-Authenticate: Basic realm="SECRET AREA"
  return async function basicAuth(req) {
    const authorization = req.headers.get("authorization");
    if (!authorization) {
      return req.respond({
        status: 401,
        headers: new Headers({
          "www-authenticate": 'Basic realm="RECRET AREA"',
        }),
        body: message ?? "Authentication Required",
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
