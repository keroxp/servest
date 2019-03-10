// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { ServerResponse, writeResponse } from "./server.ts";

type Writer = Deno.Writer;
type Reader = Deno.Reader;

/** basic responder for http response */
export interface ServerResponder {
  respond(response: ServerResponse): Promise<void>;

  readonly isResponded: boolean;
}

/** create ServerResponder object */
export function createResponder(w: Writer): ServerResponder {
  return new ServerResponderImpl(w);
}

class ServerResponderImpl implements ServerResponder {
  constructor(private w: Writer) {}

  private _responded: boolean = false;

  get isResponded() {
    return this._responded;
  }

  private checkIfResponded() {
    if (this.isResponded) {
      throw new Error("http: already responded");
    }
  }

  async respond(response: ServerResponse): Promise<void> {
    this.checkIfResponded();
    this._responded = true;
    return writeResponse(this.w, response);
  }
}
