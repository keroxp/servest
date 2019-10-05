export async function main() {
  const tgt = Deno.env()["TARGET"];
  console.log("start benching for "+tgt);
  await Deno.run({args: ["deno", "fetch", tgt ]}).status();
  Deno.run({args: ["deno", "-A", tgt]});
  await new Promise(resolve => setTimeout(resolve, 1000));
  const p2 = Deno.run({
    args: ["wrk", "-t12", "-c400", "-d30s", "http://127.0.0.1:4500"]
  });
  await p2.status();
}
main();