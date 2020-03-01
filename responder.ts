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

  /** Mark as responded manually */
  markAsResponded(status: number): void;

  isResponded(): boolean;

  /** Mark as connection upgraded */
  markAsUpgraded(): void;

  isUpgraded(): boolean;

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
  let upgraded = false;
  function isResponded() {
    return responseStatus !== undefined;
  }
  function isUpgraded() {
    return upgraded;
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
      throw new Error("Request already responded");
    }
    if (isUpgraded()) {
      throw new Error("Request upgraded");
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
  function markAsResponded(status: number) {
    responseStatus = status;
  }
  function markAsUpgraded() {
    upgraded = true;
  }
  function respondedStatus() {
    return responseStatus;
  }
  return {
    respond,
    redirect,
    isResponded,
    isUpgraded,
    respondedStatus,
    markAsResponded,
    markAsUpgraded,
    ...cookie
  };
}
