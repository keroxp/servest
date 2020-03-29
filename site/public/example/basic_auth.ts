// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { basicAuth } from "../../../middleware.ts";
import { createApp } from "../../../app.ts";
const app = createApp();
// Add global auth middleware
app.use(
  basicAuth({
    username: "deno",
    password: "deno is nice",
  }),
);
app.get("/", async (req) => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/plain",
    }),
    body: "Hello, Servest!",
  });
});
app.listen(":8899");
