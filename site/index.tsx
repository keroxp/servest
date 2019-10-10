// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import React from "./vendor/https/dev.jspm.io/react/index.js";

import { createRouter } from "../router.ts";
import { serveStatic } from "../serve_static.ts";
import { Loglevel } from "../logger.ts";
import { Layout } from "./components/layout.tsx";
import { pathResolver } from "../util.ts";
import { serveJsx } from "../serve_jsx.ts";

const port = Deno.env()["PORT"] || "8899";
const router = createRouter({ logLevel: Loglevel.INFO });
const resolve = pathResolver(import.meta.url);
router.use(serveStatic(resolve("./public")));
router.use(serveJsx(resolve("./pages"), Layout));
router.listen(":" + port);
