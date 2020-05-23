// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { STATUS_TEXT } from "./vendor/https/deno.land/std/http/http_status.ts";
export class RoutingError extends Error {
  constructor(readonly status: number, msg?: string) {
    super(msg ?? STATUS_TEXT.get(status) ?? "");
  }
}
export class UnexpectedEofError extends Error {
  constructor(msg = "unexpected eof") {
    super(msg);
  }
}

/** error that is thrown when tcp connection is closed */
export class ConnectionClosedError extends Error {
  constructor(msg = "connection closed") {
    super(msg);
  }
}

export class TimeoutError extends Error {
  constructor(msg = "operation timeout") {
    super(msg);
  }
}
