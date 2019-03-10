// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { ServerResponse, writeResponse } from "./server.ts";

type Writer = Deno.Writer;

/** basic responder for http response */
export interface ServerResponder {
  respond(response: ServerResponse): Promise<void>;

  readonly isResponded: boolean;
}

/** create ServerResponder object */
export function createResponder(w: Writer): ServerResponder {
  let isResponded = false;
  const checkIfResponded = () => {
    if (isResponded) {
      throw new Error("http: already responded");
    }
  };
  return {
    get isResponded() {
      return isResponded;
    },
    async respond(response: ServerResponse): Promise<void> {
      checkIfResponded();
      isResponded = true;
      return writeResponse(w, response);
    }
  };
}
