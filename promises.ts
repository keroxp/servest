// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.

export class TimeoutError extends Error {}

/** returns curried promise factory that  */
export function promiseInterrupter({
  timeout = -1,
  cancel
}: {
  timeout?: number;
  cancel?: Promise<void>;
}): <T>(p: Promise<T>) => Promise<T> {
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
