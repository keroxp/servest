// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { Router } from "./router.ts";
import { assertThrowsAsync } from "./vendor/https/deno.land/std/testing/asserts.ts";
import { RoutingError } from "./error.ts";
import { kHttpStatusMessages } from "./serveio.ts";
import { createRecorder } from "./testing.ts";

type PromiseOrVal<T> = T | Promise<T>;
export type SetupFunc = () => PromiseOrVal<TearDownFunc | void>;
export type TearDownFunc = () => PromiseOrVal<void>;

export interface GroupBody {
  setupAll(func: SetupFunc): void;
  setupEach(func: SetupFunc): void;
  test: typeof Deno.test;
}
export type GroupHead = Omit<Deno.TestDefinition, "fn">;
type TestFunc = () => PromiseOrVal<void>;
export async function group(
  desc: string | GroupHead,
  body: (p: GroupBody) => void,
): Promise<void> {
  const prefix = typeof desc === "string" ? desc : desc.name;
  let setupAllFuncs: (SetupFunc)[] = [];
  const tearDownFuncs: (TearDownFunc)[] = [];
  let setupEachFuncs: (SetupFunc)[] = [];
  function setupAll(f: SetupFunc): void {
    setupAllFuncs.push(f);
  }
  function setupEach(f: SetupFunc): void {
    setupEachFuncs.push(f);
  }
  function test(f: TestFunc): void;
  function test(s: string, f: TestFunc): void;
  function test(d: Deno.TestDefinition): void;
  function test(
    arg1: (TestFunc | string | Deno.TestDefinition),
    arg2?: TestFunc,
  ) {
    let fn: TestFunc;
    let name: string;
    if (typeof arg1 === "function") {
      fn = arg1;
      name = fn.name ?? "";
    } else if (typeof arg1 === "string") {
      if (arg2 == null) throw new Error("invalid arg");
      name = arg1;
      fn = arg2;
    } else {
      name = arg1.name;
      fn = arg1.fn;
    }
    name = `${prefix} ${name}`;
    let opts: GroupHead;
    if (typeof desc !== "string") {
      opts = {
        ...desc,
        name,
      };
    } else {
      opts = { name };
    }
    Deno.test({
      ...opts,
      async fn() {
        const tearDownFuncs: (TearDownFunc | undefined)[] = [];
        for (const setupFunc of setupEachFuncs) {
          if (!setupFunc) continue;
          const tearDown = await setupFunc?.();
          if (!tearDown) continue;
          tearDownFuncs.push(tearDown);
        }
        try {
          await fn();
        } finally {
          for (let i = tearDownFuncs.length - 1; i >= 0; i--) {
            const tearDown = tearDownFuncs[i];
            await tearDown?.();
          }
        }
      },
    });
  }
  Deno.test({
    name: `${prefix} beforeAll`,
    disableResourceSanitizer: true,
    disableOpSanitizer: false,
    async fn() {
      for (const setup of setupAllFuncs) {
        if (!setup) continue;
        const tearDown = await setup?.();
        if (!tearDown) continue;
        tearDownFuncs.push(tearDown);
      }
    },
  });
  body({ test, setupAll, setupEach });
  Deno.test({
    name: `${prefix} afterAll`,
    disableResourceSanitizer: true,
    disableOpSanitizer: false,
    async fn() {
      for (let i = tearDownFuncs.length - 1; i >= 0; i--) {
        const tearDown = tearDownFuncs[i];
        await tearDown?.();
      }
    },
  });
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
  status: number,
) {
  await assertThrowsAsync(f, RoutingError, kHttpStatusMessages[status]);
}
