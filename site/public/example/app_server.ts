// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { createApp } from "../../../app.ts";
const app = createApp();
// Define route with string pattern.
// Called if request path exactly match "/"
app.get("/", async (req) => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/plain",
    }),
    body: "Hello, Servest!",
  });
});
// Define route with regexp pattern.
// Called if request path matches regex.
// If multiple route matches path, the longest match route will be called.
app.get(new RegExp("^/foo/(.+)"), async (req, { match }) => {
  const [_, id] = match;
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "application/json",
    }),
    body: JSON.stringify({ id }),
  });
});
// Start listening on port 8899
app.listen(":8899");
