import {
  test,
  TestFunction
} from "./vendor/https/deno.land/std/testing/mod.ts";

export type SetupFunc = () => any | Promise<any>;
export interface Testing {
  run(desc: string, body: TestFunction): void;
  beforeAfterAll(func: () => SetupFunc | Promise<SetupFunc>):  void;
  beforeAfterEach(func: () => SetupFunc | Promise<SetupFunc>): void;
}
export function it(desc: string, func: (t: Testing) => void) {
  let testCnt = 0;
  let beforeAllFunc: SetupFunc | undefined;
  let afterAllFunc: SetupFunc | undefined;
  let beforeEachFunc: SetupFunc | undefined;
  let afterEachFunc: SetupFunc | undefined;
  function beforeAfterAll(func) {
    beforeAllFunc = func;
  }
  function beforeAfterEach(func) {
    beforeEachFunc = func;
  }
  function run(desc2: string, func2: () => any | Promise<any>) {
    test(`${desc} ${desc2}`, async () => {
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
