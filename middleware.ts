// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { HttpHandler } from "./router.ts";
import { RoutingError } from "./error.ts";

/** Deny request with 404 if method doesn't match */
export const methodFilter = (...method: string[]): HttpHandler => async req => {
  if (!method.includes(req.method)) {
    const u = new URL(req.url, "http://dummy");
    throw new RoutingError(404, `Cannot ${req.method} ${u.pathname}`);
  }
};

/** Deny requests with 400 if content-type doesn't match */
export const contentTypeFilter = (
  ...types: (string | RegExp)[]
): HttpHandler => async req => {
  if (types.some(v => req.headers.get("content-type").match(v) !== null)) {
    return;
  }
  throw new RoutingError(400, `Invalid content type`);
};
