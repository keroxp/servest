// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
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
app.use(async (req) => {
  // Add header to response
  req.responseHeaders.set("my-header", "value");
});
app.use(async (req) => {
  // Set arbitary data
  req.set("my-data", "value");
  req.set("my-date", new Date());
});
app.use(async (req) => {
  // Get data set by previous middlewares
  const myData = req.getString("my-data");
  const myDate = req.get<Date>("my-date");
});
app.listen({ port: 8899 });
