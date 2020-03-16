// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.

import { Router } from "./router.ts";
import { createRecorder } from "./testing.ts";
import {
  assertEquals,
  assert,
  assertThrowsAsync
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { RoutingError } from "./error.ts";
import { kHttpStatusMessages } from "./serveio.ts";

export type SetupFunc = () => any | Promise<any>;
export interface Testing {
  run(desc: string, body: () => void | Promise<void>): void;
  beforeAfterAll(func: () => SetupFunc | Promise<SetupFunc>): void;
  beforeAfterEach(func: () => SetupFunc | Promise<SetupFunc>): void;
}
export function it(
  desc: string,
  func: (t: Testing) => void,
  ignore: boolean = false
) {
  let testCnt = 0;
  let beforeAllFunc: SetupFunc | undefined;
  let afterAllFunc: SetupFunc | undefined;
  let beforeEachFunc: SetupFunc | undefined;
  let afterEachFunc: SetupFunc | undefined;
  function beforeAfterAll(func: SetupFunc) {
    beforeAllFunc = func;
  }
  function beforeAfterEach(func: SetupFunc) {
    beforeEachFunc = func;
  }
  function run(desc2: string, func2: () => any | Promise<any>) {
    Deno.test(`${desc} ${desc2}`, async () => {
      if (ignore) {
        console.warn("ignored");
        return;
      }
      if (testCnt === 0 && beforeAllFunc) {
        afterAllFunc = await beforeAllFunc();
      }
      testCnt++;
      try {
        if (beforeEachFunc) {
          afterEachFunc = await beforeEachFunc();
        }
        await func2();
      } finally {
        if (afterEachFunc) {
          await afterEachFunc();
        }
        setTimeout(async () => {
          testCnt--;
          if (testCnt === 0 && afterAllFunc) {
            await afterAllFunc();
          }
        }, 0);
      }
    });
  }
  func({ beforeAfterAll, beforeAfterEach, run });
}

export function makeGet(router: Router, method = "GET") {
  return async function get(url: string) {
    const rec = createRecorder({ method, url });
    await router.handleRoute("", rec);
    return rec.response();
  };
}

export async function assertRoutingError(
  f: () => Promise<any>,
  status: number
) {
  await assertThrowsAsync(f, RoutingError, kHttpStatusMessages[status]);
}
