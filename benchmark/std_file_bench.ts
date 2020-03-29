// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { serve } from "https://deno.land/std@v0.32.0/http/server.ts";
const it = serve(":4500");
async function main() {
  const path = new URL("./main.ts", import.meta.url).pathname;
  for await (const req of it) {
    Deno.open(path).then((body) => {
      req
        .respond({
          status: 200,
          body,
        })
        .finally(() => body.close());
    });
  }
}
main();
