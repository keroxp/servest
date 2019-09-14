// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
export async function promiseTimeout(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
