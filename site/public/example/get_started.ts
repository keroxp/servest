// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { createApp } from "../../../app.ts";
const app = createApp();
app.handle("/", async (req) => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/plain",
    }),
    body: "Hello, Servest!",
  });
});
app.listen({ port: 8899 });
