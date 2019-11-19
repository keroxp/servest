// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
interface Performance {
  start(mark: string);

  end(mark: string);

  dump();
}

type Value = {
  mark: string;
  total: number;
  count: number;
  children: Value[];
};

export default createPerformance();
export function createPerformance(): Performance {
  const o = new Map<string, Value>();
  const f = new Map<string, number>();
  function start(mark: string) {
    f.set(mark, performance.now());
  }

  function end(mark: string) {
    const n = performance.now();
    const s = f.get(mark) || n;
    let v = o.get(mark);
    if (!v) {
      v = { total: 0, count: 0, mark, children: [] };
      o.set(mark, v);
    }
    v.total += n - s;
    v.count += 1;
  }

  function dump() {
    for (const [k, v] of o.entries()) {
      const round = (v: number) => Math.round(v * 100) / 100;
      console.log(
        `${k}:\ttotal=${round(v.total)}ms\taverage=${round(
          v.total / v.count
        )}ms`
      );
    }
  }

  return { start, end, dump };
}
