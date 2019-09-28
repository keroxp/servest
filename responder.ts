// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import Writer = Deno.Writer;
import { kHttpStatusMessages } from "./serveio.ts";
import * as serveio from "./serveio.ts";
import { ServerResponse } from "./server.ts";

/** Basic responder for http response */
export interface ServerResponder {
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
}

/** create ServerResponder object */
export function createResponder(w: Writer): ServerResponder {
  let responded = false;
  let headers: Headers;
  function isResponded() {
    return responded;
  }
  async function writeTrailers(trailers: Headers): Promise<void> {
    if (!isResponded) {
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
    await respond({
      status: 302,
      headers,
      body
    });
  }
  async function respond(response: ServerResponse): Promise<void> {
    if (responded) {
      throw new Error("http: already responded");
    }
    headers = response.headers;
    responded = true;
    await serveio.writeResponse(w, response);
  }
  return {
    respond,
    redirect,
    isResponded,
    writeTrailers
  };
}

export function badRequest(): ServerResponse {
  return { status: 400, body: kHttpStatusMessages[400] };
}

export function unauthorized(): ServerResponse {
  return { status: 401, body: kHttpStatusMessages[401] };
}

export function forbidden(): ServerResponse {
  return { status: 403, body: kHttpStatusMessages[403] };
}

export function notFound(): ServerResponse {
  return { status: 404, body: kHttpStatusMessages[404] };
}

export function internalServerError(): ServerResponse {
  return { status: 500, body: kHttpStatusMessages[500] };
}
