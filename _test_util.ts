// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { RoutingError } from "./error.ts";
import { Router } from "./router.ts";
import { createRecorder } from "./testing.ts";
import { STATUS_TEXT } from "./vendor/https/deno.land/std/http/http_status.ts";
import {
  assertThrowsAsync,
} from "./vendor/https/deno.land/std/testing/asserts.ts";

export function makeGet(router: Router, method = "GET") {
  return async function get(url: string) {
    const rec = createRecorder({ method, url });
    await router.handleRoute("", rec);
    return rec.response();
  };
}

export async function assertRoutingError(
  f: () => Promise<any>,
  status: number,
) {
  await assertThrowsAsync(f, RoutingError, STATUS_TEXT.get(status));
}
