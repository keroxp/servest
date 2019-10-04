import { HttpHandler } from "./router.ts";
import { RoutingError } from "./error.ts";

/** Deny request with 404 if method doesn't match */
export const methodFilter = (...method: string[]): HttpHandler => req => {
  if (!method.includes(req.method)) {
    const u = new URL(req.url);
    throw new RoutingError(404, `Cannot ${req.method} ${u.pathname}`);
  }
};
