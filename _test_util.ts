// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { Router } from "./router.ts";
import {
  assertThrowsAsync,
  AssertionError,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { RoutingError } from "./error.ts";
import { createRecorder } from "./testing.ts";
import { encode } from "./vendor/https/deno.land/std/encoding/utf8.ts";
import { red, green } from "./vendor/https/deno.land/std/fmt/colors.ts";
import { STATUS_TEXT } from "./vendor/https/deno.land/std/http/http_status.ts";

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
export function group(
  desc: string | GroupHead,
  body: (p: GroupBody) => void,
): void {
  let opts: GroupHead;
  if (typeof desc !== "string") {
    opts = { ...desc };
  } else {
    opts = { name: desc };
  }
  let setupAllFuncs: (SetupFunc)[] = [];
  let setupEachFuncs: (SetupFunc)[] = [];
  function setupAll(f: SetupFunc): void {
    setupAllFuncs.push(f);
  }
  function setupEach(f: SetupFunc): void {
    setupEachFuncs.push(f);
  }
  const tests: Deno.TestDefinition[] = [];
  function wrap(funcs: SetupFunc[], fn: TestFunc): TestFunc {
    return async () => {
      const tearDowns: (TearDownFunc)[] = [];
      for (const setupFunc of funcs) {
        if (!setupFunc) continue;
        const tearDown = await setupFunc?.();
        if (!tearDown) continue;
        tearDowns.push(tearDown);
      }
      try {
        await fn();
      } finally {
        for (let i = tearDowns.length - 1; i >= 0; i--) {
          const tearDown = tearDowns[i];
          await tearDown?.();
        }
      }
    };
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
    tests.push({ ...opts, name, fn: wrap(setupEachFuncs, fn) });
  }
  body({ test, setupAll, setupEach });
  Deno.test({
    ...opts,
    fn: wrap(setupAllFuncs, async () => {
      await Deno.writeAll(Deno.stdout, encode("\n"));
      for (const { fn, name } of tests) {
        await Deno.writeAll(Deno.stdout, encode(`  ${name} ... `));
        try {
          await fn();
          await Deno.writeAll(Deno.stdout, encode(green("ok") + "\n"));
        } catch (e) {
          if (e instanceof AssertionError) {
            await Deno.writeAll(Deno.stdout, encode(red("FAILED") + "\n"));
          } else {
            await Deno.writeAll(Deno.stdout, encode(red("ERROR") + "\n"));
          }
          throw e;
        }
      }
    }),
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
  await assertThrowsAsync(f, RoutingError, STATUS_TEXT.get(status));
}
