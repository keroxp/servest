// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { createRouter } from "../router.ts";
import { serveStatic } from "../serve_static.ts";
const router = createRouter();
const port = Deno.env()["PORT"] || "8899";
const { pathname } = new URL("./public", import.meta.url);
router.use(serveStatic(pathname));
router.listen(":" + port);
console.log("servest-site: running on :" + port);
