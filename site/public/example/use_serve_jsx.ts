// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { serveJsx } from "../../../serve_jsx.ts";
import { createApp } from "../../../app.ts";
const app = createApp();
// .jsx/.tsx files in ./pages directory will be dynamically imported
// and rendered component served as html
app.use(serveJsx("./pages", (f) => import(f)));
app.listen(":8899");
