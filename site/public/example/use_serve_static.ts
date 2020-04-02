// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { serveStatic } from "../../../serve_static.ts";
import { createApp } from "../../../app.ts";
const app = createApp();
// All requests will be processed and matched files in "public" directory
// are served automatically
// Otherwise, request will be passed to next handler
app.use(serveStatic("./public"));
app.listen({ port: 8899 });
