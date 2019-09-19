// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import Writer = Deno.Writer;
import {
  kHttpStatusMessages,
  writeResponse,
  writeTrailers
} from "./serveio.ts";
import { ServerResponse } from "./server.ts";

/** basic responder for http response */
export interface ServerResponder {
  respond(response: ServerResponse): Promise<void>;

  writeTrailers(trailers: Headers): Promise<void>;

  isResponded(): boolean;
}

/** create ServerResponder object */
export function createResponder(w: Writer): ServerResponder {
  let isResponded = false;
  let headers: Headers;
  return {
    isResponded() {
      return isResponded;
    },
    async writeTrailers(trailers: Headers): Promise<void> {
      if (!isResponded) {
        throw new Error("trailer headers can't be written before responding");
      }
      await writeTrailers(w, headers, trailers);
    },
    async respond(response: ServerResponse): Promise<void> {
      if (isResponded) {
        throw new Error("http: already responded");
      }
      headers = response.headers;
      isResponded = true;
      return writeResponse(w, response);
    }
  };
}

const encoder = new TextEncoder();

export function badRequest(): ServerResponse {
  return { status: 400, body: encoder.encode(kHttpStatusMessages[400]) };
}

export function unauthorized(): ServerResponse {
  return { status: 401, body: encoder.encode(kHttpStatusMessages[401]) };
}

export function forbidden(): ServerResponse {
  return { status: 403, body: encoder.encode(kHttpStatusMessages[403]) };
}

export function notFound(): ServerResponse {
  return { status: 404, body: encoder.encode(kHttpStatusMessages[404]) };
}

export function internalServerError(): ServerResponse {
  return { status: 500, body: encoder.encode(kHttpStatusMessages[500]) };
}
