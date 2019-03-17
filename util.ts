import {defer} from "./deferred.ts";

export async function wait<T>(msec: number, res?: T): Promise<T> {
  if (msec < 0) return defer<T>().promise;
  return new Promise<T>(resolve => {
    setTimeout(() => resolve(res), msec);
  });
}
