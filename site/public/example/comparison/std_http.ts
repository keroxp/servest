// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import {
  serve,
} from "https://deno.land/std/http/mod.ts";

for await (const req of serve({ port: 8888 })) {
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/plain",
    }),
    body: "hellow deno!",
  });
}
