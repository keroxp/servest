// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { serve } from "../server.ts";

const addr = Deno.args[1] || "127.0.0.1:4500";
const body = new TextEncoder().encode("Hello World");

async function main(): Promise<void> {
  for await (const req of serve(addr)) {
    try {
      await req.respond({ status: 200, body });
    } catch (e) {}
  }
}

main();
