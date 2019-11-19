// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { createRouter } from "../../../router.ts";
import { serveJsx } from "../../../serve_jsx.ts";
const router = createRouter();
// .jsx/.tsx files in ./pages directory will be dynamically imported
// and rendered component served as html
router.use(serveJsx("./pages", f => import(f)));
router.listen(":8899");
