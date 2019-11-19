// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
export class RoutingError extends Error {
  constructor(readonly status: number, readonly msg: string) {
    super(msg);
  }
}
