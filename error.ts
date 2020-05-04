// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { STATUS_TEXT } from "./vendor/https/deno.land/std/http/http_status.ts";
export class RoutingError extends Error {
  constructor(readonly status: number, msg?: string) {
    super(msg ?? STATUS_TEXT.get(status) ?? "");
  }
}
export class UnexpectedEofError extends Error {
}

/** error that is thrown when tcp connection is closed */
export class ConnectionClosedError extends Error {}
