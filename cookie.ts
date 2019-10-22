// Cookie: NAME1=OPAQUE_STRING1; NAME2=OPAQUE_STRING2 ...

import { dateToIMF, parseIMF } from "./util.ts";

export type SetCookieOpts = {
  expires?: Date;
  maxAge?: number;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Strict" | "Lax";
};

export function parseCookie(header: string): Map<string, string> {
  const query = header
    .split(";")
    .map(v => v.trim())
    .join("&");
  return new Map(new URLSearchParams(query).entries());
}

export function parseSetCookie(
  header: string
):
  | {
      name: string;
      value: string;
      opts: SetCookieOpts;
    }
  | undefined {
  const m = header.match(/^(.+?)=(.+?);(.+?)$/);
  if (!m) {
    return;
  }
  const [_, name, value, optStr] = m;
  const optMap = new Headers(
    optStr.split(";").map(i => {
      const [k, v] = i.trim().split("=");
      return [k, v];
    })
  );
  const domain = optMap.get("Domain") || undefined;
  const path = optMap.get("Path") || undefined;
  const secure = optMap.has("Secure") || undefined;
  const httpOnly = optMap.has("HttpOnly") || undefined;
  const sameSite = optMap.get("SameSite") || undefined;
  let expires: Date | undefined;
  if (optMap.has("Expires")) {
    const e = optMap.get("Expires")!;
    expires = parseIMF(e);
  }
  let maxAge: number | undefined;
  if (optMap.has("Max-Age")) {
    const m = optMap.get("Max-Age")!;
    maxAge = parseInt(m);
  }
  if (sameSite !== "Lax" && sameSite !== "Strict") {
    throw new Error("sameSite is invalid");
  }
  return {
    name,
    value,
    opts: {
      expires,
      maxAge,
      domain,
      path,
      secure,
      httpOnly,
      sameSite
    }
  };
}

export function cookieToString(
  name: string,
  value: string,
  opts: SetCookieOpts = {}
) {
  const out: string[] = [];
  out.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  if (opts.expires != null) {
    out.push("Expires=" + dateToIMF(opts.expires));
  }
  if (opts.maxAge != null) {
    if (!Number.isInteger(opts.maxAge) || opts.maxAge <= 0) {
      throw new TypeError("maxAge must be integer and > 0");
    }
    out.push("Max-Age=" + opts.maxAge);
  }
  if (opts.domain != null) {
    out.push("Domain=" + opts.domain);
  }
  if (opts.path != null) {
    out.push("Path=" + opts.path);
  }
  if (opts.secure != null) {
    out.push("Secure");
  }
  if (opts.httpOnly != null) {
    out.push("HttpOnly");
  }
  if (opts.sameSite != null) {
    out.push("SameSite=" + opts.sameSite);
  }
  return out.join("; ");
}

export interface CookieSetter {
  setCookie(name: string, value: string, opts?: SetCookieOpts): void;
  clearCookie(name: string, opts?: { path?: string }): void;
}

export function cookieSetter(responseHeaders: Headers): CookieSetter {
  function clearCookie(name: string, opts: { path?: string } = {}) {
    const out: string[] = [];
    out.push(`${name}=`);
    if (opts.path) {
      out.push("Path=" + opts.path);
    }
    out.push("Expires=" + dateToIMF(new Date(0)));
    const v = out.join("; ");
    responseHeaders.set("Set-Cookie", v);
  }
  function setCookie(name: string, value: string, opts: SetCookieOpts = {}) {
    responseHeaders.set("Set-Cookie", cookieToString(name, value, opts));
  }
  return { setCookie, clearCookie };
}
