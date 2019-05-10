// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
export type Deferred<T = any, R = Error> = {
  promise: Promise<T>;
  resolve: (t?: T) => void;
  reject: (r?: R) => void;
  readonly handled: boolean;
};

/** Create deferred promise that can be resolved and rejected by outside */
export function defer<T = void>(): Deferred<T> {
  let handled = false;
  let resolve;
  let reject;
  const promise = new Promise<T>((res, rej) => {
    resolve = r => {
      handled = true;
      res(r);
    };
    reject = r => {
      handled = true;
      rej(r);
    };
  });
  return {
    promise,
    resolve,
    reject,
    get handled() {
      return handled;
    }
  };
}

export async function delay(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export class TimeoutError extends Error {}

/** returns curried promise factory that  */
export function promiseInterrupter(opts: {
  timeout?: number;
  cancel?: Promise<void>;
}): <T>(p: Promise<T>) => Promise<T> {
  let { timeout, cancel } = opts;
  timeout = Number.isInteger(timeout) ? timeout : -1;
  return <T>(p) =>
    new Promise<T>((resolve, reject) => {
      if (timeout < 0) {
        p.then(resolve).catch(reject);
        if (cancel) {
          cancel.then(reject).catch(reject);
        }
      } else {
        const i = setTimeout(() => {
          reject(new TimeoutError());
        }, timeout);
        const clear = () => clearTimeout(i);
        p.then(resolve)
          .catch(reject)
          .finally(clear);
        if (cancel) {
          cancel
            .then(reject)
            .catch(reject)
            .finally(clear);
        }
      }
    });
}
