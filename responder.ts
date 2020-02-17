// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import Writer = Deno.Writer;
import { ServerResponse } from "./server.ts";
import { cookieSetter, CookieSetter } from "./cookie.ts";
import { writeResponse } from "./serveio.ts";

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

  /** Mark this responded from other way */
  markResponded(status: number): void;

  isResponded(): boolean;

  respondedStatus(): number | undefined;

}

/** create ServerResponder object */
export function createResponder(
  w: Writer,
  onResponse: (r: ServerResponse) => Promise<void> = resp =>
    writeResponse(w, resp)
): ServerResponder {
  const responseHeaders = new Headers();
  const cookie = cookieSetter(responseHeaders);
  let responseStatus: number | undefined;
  function isResponded() {
    return responseStatus !== undefined;
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
    const { status, headers, body } = response;
    responseStatus = status;
    if (headers) {
      for (const [k, v] of headers.entries()) {
        responseHeaders.append(k, v);
      }
    }
    await onResponse({
      status,
      headers: responseHeaders,
      body
    });
  }
  function markResponded(status: number) {
    responseStatus = status;
  }
  function respondedStatus() {
    return responseStatus;
  }
  return {
    respond,
    redirect,
    isResponded,
    respondedStatus,
    markResponded,
    ...cookie
  };
}
