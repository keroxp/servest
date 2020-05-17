// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import {
  createApp,
} from "../../../../mod.ts";
const app = createApp();
app.handle("/", async (req) => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/plain",
    }),
    body: "hellow deno!",
  });
});
app.listen({ port: 8888 });
