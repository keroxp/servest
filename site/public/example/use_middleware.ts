// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { createApp } from "../../../mod.ts";
const app = createApp();
// Called for every request
app.use(async (req) => {
  // Do authentication before handling request on routes
  const token = req.query.get("auth_token");
  if (token !== "valid_token") {
    // Responded request won't be passed to the next middleware
    await req.respond({ status: 401, body: "Unauthorized" });
  }
  // Go through the next middleware
});
app.listen({ port: 8899 });
