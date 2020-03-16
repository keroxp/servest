import { kHttpStatusMessages } from "./serveio.ts";

// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
export class RoutingError extends Error {
  constructor(readonly status: number, msg?: string) {
    super(msg ?? kHttpStatusMessages[status]);
  }
}
