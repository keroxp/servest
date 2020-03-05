// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { createRouter } from "../../../router.ts";
import { basicAuth } from "../../../middleware.ts";
const router = createRouter();
// Add global auth middleware
router.use(
  basicAuth({
    username: "deno",
    password: "deno is nice"
  })
);
router.get("/", async req => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/plain"
    }),
    body: "Hello, Servest!"
  });
});
router.listen(":8899");
