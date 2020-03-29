// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { listenAndServe } from "../server.ts";

const addr = Deno.args[1] || "127.0.0.1:4500";

async function main(): Promise<void> {
  const path = new URL("./main.ts", import.meta.url).pathname;
  listenAndServe(addr, async (req) => {
    Deno.open(path).then((body) => {
      req.respond({ status: 200, body }).finally(() => {
        body.close();
      });
    });
  });
}

main();
