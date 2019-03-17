// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import Writer = Deno.Writer;
import { writeResponse, writeTrailers } from "./serveio.ts";
import { ServerResponse } from "./server.ts";

/** basic responder for http response */
export interface ServerResponder {
  respond(response: ServerResponse): Promise<void>;
  writeTrailers(trailers: Headers): Promise<void>;
  readonly isResponded: boolean;
}

/** create ServerResponder object */
export function createResponder(w: Writer): ServerResponder {
  let isResponded = false;
  let headers: Headers;
  return {
    get isResponded() {
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
