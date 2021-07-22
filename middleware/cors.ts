// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { ServeHandler, ServerRequest } from "../server.ts";
type OriginVerifier = string | RegExp | ((s: string) => boolean);
export interface CORSOptions {
  /**
   * verifier for Access-Control-Allow-Origin
   * Specifies either a single origin, which tells browsers to allow that
   * origin to access the resource; or else — for requests without
   * credentials — the "*" wildcard, to tell browsers to allow any origin
   * to access the resource.
   */
  origin: OriginVerifier | OriginVerifier[];
  /**
   * Values for Access-Control-Allow-Methods.
   * Specifies the method or methods allowed when accessing the resource.
   * This is used in response to a preflight request.
   *
   * @default none
   */
  methods?: string[];
  /**
   * Values for Access-Control-Allow-Headers.
   * Is used in response to a preflight request to indicate which HTTP headers
   * can be used when making the actual request. This header is the server side
   * response to the browser's Access-Control-Request-Headers header
   * @default none
   */
  allowedHeaders?: string[];
  /**
   * Values for Access-Control-Expose-Headers.
   * Lets a server whitelist headers that Javascript
   * (such as getResponseHeader()) in browsers are allowed to access.
   * @default none
   */
  exposedHeaders?: string[];
  /**
   * Value for Access-Control-Allow-Credentials.
   * Indicates whether or not the response to the request can be exposed when
   * the credentials flag is true. When used as part of a response to a preflight
   * request, this indicates whether or not the actual request can be made using
   * credentials. Note that simple GET requests are not preflighted, and so if a
   * request is made for a resource with credentials, if this header is not
   * returned with the resource, the response is ignored by the browser and not
   * returned to web content.
   * @default none
   */
  withCredentials?: boolean;
  /**
   * Values for Access-Control-Max-Age.
   * Indicates how long the results of a preflight request can be cached.
   * @default 0
   */
  maxAge?: number;
}
export function cors({
  origin,
  methods = [],
  allowedHeaders = [],
  exposedHeaders = [],
  withCredentials = false,
  maxAge = 0,
}: CORSOptions): ServeHandler {
  return (req) => {
    const requestOrigin = req.headers.get("origin");
    if (!requestOrigin) {
      return;
    }
    if (req.method === "OPTIONS") { //preflight
      const isValidOrigin = setAccessControlAllowOrigin(
        origin,
        requestOrigin,
        req,
      );
      if (isValidOrigin === false) return;
      setAccessControlRequestMethods(methods, req);
      setAccessControlRequestHeaders(allowedHeaders, req);
      setAcessControlExposeHeaders(exposedHeaders, req);

      req.responseHeaders.set(
        "access-control-allow-credentials",
        withCredentials.toString(),
      );
      req.responseHeaders.set("access-control-max-age", `${maxAge}`);

      return req.respond({ status: 204 });
    } else { //actual response
      setAccessControlAllowOrigin(origin, requestOrigin, req);
      setAcessControlExposeHeaders(exposedHeaders, req);
      req.responseHeaders.set(
        "access-control-allow-credentials",
        withCredentials.toString(),
      );
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

function setAccessControlAllowOrigin(
  origin: OriginVerifier | OriginVerifier[],
  requestOrigin: string,
  req: ServerRequest,
) {
  if (origin === "*") {
    req.responseHeaders.set("access-control-allow-origin", "*");
  } else if (verifyOrigin(origin, requestOrigin)) {
    req.responseHeaders.set("access-control-allow-origin", requestOrigin);
  } else {
    return false;
  }
}

function setAccessControlRequestMethods(methods: string[], req: ServerRequest) {
  const requestMethods = req.headers.get("access-control-request-methods");
  if (requestMethods && methods.length > 0) {
    const list = requestMethods.split(",").map((v) => v.trim());
    const allowed = list.filter((v) => methods.includes(v));
    req.responseHeaders.set(
      "access-control-allow-methods",
      allowed.join(", "),
    );
  } else {
    req.responseHeaders.set(
      "access-control-allow-methods",
      methods.join(", "),
    );
  }
}

function setAcessControlExposeHeaders(
  exposedHeaders: string[],
  req: ServerRequest,
) {
  if (exposedHeaders.length > 0) {
    req.responseHeaders.set(
      "access-control-expose-headers",
      exposedHeaders.join(", "),
    );
  }
}

function setAccessControlRequestHeaders(
  allowedHeaders: string[],
  req: ServerRequest,
) {
  const requestHeaders = req.headers.get("access-control-request-headers");
  if (requestHeaders && allowedHeaders.length > 0) {
    const list = requestHeaders.split(",").map((v) => v.trim());
    const allowed = list.filter((v) => allowedHeaders.includes(v));
    req.responseHeaders.set(
      "access-control-allow-headers",
      allowed.join(", "),
    );
  }
}
