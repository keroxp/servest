// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import React from "../vendor/https/dev.jspm.io/react/index.js";

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
router.use(
  serveStatic(resolve("../"), {
    filter: file => file.endsWith(".ts")
  })
);
router.use(serveJsx(resolve("./pages"), Layout));
router.get(new RegExp("/@(?<version>.+?)/(?<pathname>.+?)$"), async req => {
  const { version, pathname } = req.match!.groups;
  const u = `https://raw.githubusercontent.com/keroxp/servest/${version}/${pathname}`;
  await fetch(u).then(req.respond);
});
router.listen(":" + port);
