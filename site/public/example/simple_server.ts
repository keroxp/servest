// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { listenAndServe } from "../../../mod.ts";
const listener = listenAndServe({ port: 8899 }, async (req) => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/plain",
    }),
    body: "hello",
  });
});
