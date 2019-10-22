// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import Writer = Deno.Writer;
import * as serveio from "./serveio.ts";
import { ServerResponse } from "./server.ts";
import { cookieSetter, CookieSetter } from "./cookie.ts";

/** Basic responder for http response */
export interface ServerResponder extends CookieSetter {
  /** Respond to request */
  respond(response: ServerResponse): Promise<void>;

  /** Redirect request with 302 (Found ) */
  redirect(
    url: string,
    opts?: {
      headers?: Headers;
      body?: ServerResponse["body"];
    }
  ): Promise<void>;

  /** Write additional trailer headers in tail of response */
  writeTrailers(trailers: Headers): Promise<void>;

  isResponded(): boolean;

  respondedStatus(): number | undefined;
}

/** create ServerResponder object */
export function createResponder(w: Writer): ServerResponder {
  const headers = new Headers();
  const cookie = cookieSetter(headers);
  let status: number | undefined;
  function isResponded() {
    return status !== undefined;
  }
  async function writeTrailers(trailers: Headers): Promise<void> {
    if (!isResponded()) {
      throw new Error("trailer headers can't be written before responding");
    }
    await serveio.writeTrailers(w, headers, trailers);
  }
  async function redirect(
    url: string,
    {
      headers = new Headers(),
      body
    }: { headers?: Headers; body?: ServerResponse["body"] } = {}
  ) {
    headers.set("location", url);
    await respond({ status: 302, headers, body });
  }
  async function respond(response: ServerResponse): Promise<void> {
    if (isResponded()) {
      throw new Error("http: already responded");
    }
    status = response.status;
    if (response.headers) {
      response.headers.forEach(([v, k]) => headers.set(k, v));
    }
    await serveio.writeResponse(w, response);
  }
  function respondedStatus() {
    return status;
  }
  return {
    respond,
    redirect,
    isResponded,
    respondedStatus,
    writeTrailers,
    ...cookie
  };
}