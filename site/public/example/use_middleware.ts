// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { createRouter } from "../../../router.ts";
const router = createRouter();
// Called for every request
router.use(async req => {
  // Do authentication before handling request on routes
  const q = new URL(req.url, "http://dummy").searchParams;
  const token = q.get("auth_token");
  if (token !== "valid_token") {
    // Responded request won't be passed to the next middleware
    await req.respond({ status: 401, body: "Unauthorized" });
  }
  // Go through the next middleware
});
router.listen(":8899");
