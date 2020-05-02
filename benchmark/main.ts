// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
export async function main() {
  const tgt = Deno.env.get("TARGET");
  if (!tgt) throw new Error("TAGET is required");
  console.log("start benching for " + tgt);
  await Deno.run({ cmd: ["deno", "fetch", tgt] }).status();
  Deno.run({ cmd: ["deno", "-A", tgt] });
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const p2 = Deno.run({
    cmd: ["wrk", "-t12", "-c400", "-d30s", "http://127.0.0.1:4500"],
  });
  await p2.status();
}
main();
