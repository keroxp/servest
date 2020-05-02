// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { kHttpStatusMessages } from "./serveio.ts";
export class RoutingError extends Error {
  constructor(readonly status: number, msg?: string) {
    super(msg ?? kHttpStatusMessages[status]);
  }
}
export class UnexpectedEofError extends Error {
}

/** error that is thrown when tcp connection is closed */
export class ConnectionClosedError extends Error {}
