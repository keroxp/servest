// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { ServeHandler } from "../server.ts";
type OriginVerifier = string | RegExp | ((s: string) => boolean);
export interface CORSOptions {
  /**
   * verifier for Access-Control-Allow-Origin
   */
  origin: OriginVerifier | OriginVerifier[];
  /**
   * values for Access-Control-Allow-Method
   * @default none
   */
  methods?: string[];
  /**
   * values for Access-Control-Allow-Headers
   * @default none
   */
  allowedHeaders?: string[];
  /** 
   * values for Access-Control-Expose-Headers
   * @default none
   */
  exposedHeaders?: string[];
  /** 
   * values for Access-Control-Allow-Credentials
   * @default none
   */
  credentials?: boolean;
  /**
   * values for Access-Control-Max-Age
   * @default 0
   */
  maxAge?: number;
}
export function cors({
  origin,
  methods = [],
  allowedHeaders = [],
  exposedHeaders = [],
  credentials = false,
  maxAge = 0,
}: CORSOptions): ServeHandler {
  return (req) => {
    if (req.method === "OPTIONS") {
      const requestOrigin = req.headers.get("origin");
      if (!requestOrigin) {
        return;
      }
      if (origin === "*") {
        req.responseHeaders.set("access-control-allow-origin", "*");
      } else if (verifyOrigin(origin, requestOrigin)) {
        req.responseHeaders.set("access-control-allow-origin", requestOrigin);
      } else {
        return;
      }
      const requestMethods = req.headers.get("access-control-request-methods");
      if (requestMethods && methods.length > 0) {
        const list = requestMethods.split(",").map((v) => v.trim());
        const allowed = list.filter((v) => methods.includes(v));
        req.responseHeaders.set(
          "access-control-allow-methods",
          allowed.join(", "),
        );
      }
      const requestHeaders = req.headers.get("access-control-request-headers");
      if (requestHeaders && allowedHeaders.length > 0) {
        const list = requestHeaders.split(",").map((v) => v.trim());
        const allowed = list.filter((v) => allowedHeaders.includes(v));
        req.responseHeaders.set(
          "access-control-allow-headers",
          allowed.join(", "),
        );
      }
      if (exposedHeaders.length > 0) {
        req.responseHeaders.set(
          "accessl-control-expose-headers",
          exposedHeaders.join(", "),
        );
      }
      if (credentials) {
        req.responseHeaders.set("access-control-allow-credentials", "true");
      }
      req.responseHeaders.set("access-control-max-age", `${maxAge}`);
      return req.respond({ status: 204 });
    }
  };
}

function verifyOrigin(
  vel: OriginVerifier | OriginVerifier[],
  origin: string,
): boolean {
  if (typeof vel === "string") {
    return vel === origin;
  } else if (vel instanceof RegExp) {
    return origin.match(vel) != null;
  } else if (typeof vel === "function") {
    return vel(origin);
  } else {
    for (const v of vel) {
      if (verifyOrigin(v, origin)) {
        return true;
      }
    }
  }
  return false;
}
