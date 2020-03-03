// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import Writer = Deno.Writer;
import { ServerResponse } from "./server.ts";
import { cookieSetter, CookieSetter } from "./cookie.ts";
import { writeResponse } from "./serveio.ts";
import * as media_types from "./vendor/https/deno.land/std/media_types/mod.ts";
import { basename } from "./vendor/https/deno.land/std/path/mod.ts";

/** Basic responder for http response */
export interface ServerResponder extends CookieSetter {
  /** Respond to request */
  respond(response: ServerResponse): Promise<void>;

  /**
   * Send file as a response. Content-Type will be guessed but may not be found.
   * Default Content-Type is application/octet-stream
   *  */
  sendFile(
    path: string,
    opts?: {
      contentDisposition?: "inline" | "attachment";
      headers?: Headers;
    }
  ): Promise<void>;

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
      throw new Error("Request already responded");
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
  async function sendFile(
    path: string,
    opts?: {
      contentDisposition?: "inline" | "attachment";
      headers?: Headers;
    }
  ): Promise<void> {
    const body = await Deno.open(path);
    const headers = opts?.headers ?? new Headers();
    try {
      const contentType =
        media_types.lookup(path) ?? "application/octet-stream";
      headers.set("content-type", contentType);
      const contentDisposition = opts?.contentDisposition;
      if (contentDisposition === "inline") {
        headers.set("content-disposition", contentDisposition);
      } else if (contentDisposition === "attachment") {
        const filename = basename(path);
        headers.set(
          "content-disposition",
          `attachment; filename="${filename}"`
        );
      }
      await onResponse({
        status: 200,
        headers,
        body
      });
    } finally {
      body.close();
    }
  }
  function markAsResponded(status: number) {
    responseStatus = status;
  }
  function respondedStatus() {
    return responseStatus;
  }
  return {
    respond,
    redirect,
    sendFile,
    isResponded,
    respondedStatus,
    markAsResponded,
    ...cookie
  };
}
