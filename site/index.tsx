// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import React from "./vendor/https/dev.jspm.io/react/index.js";
import ReactDOMServer from "./vendor/https/dev.jspm.io/react-dom/server.js";

import { createRouter } from "../router.ts";
import { serveStatic } from "../serve_static.ts";
import { Loglevel } from "../logger.ts";
import { Index } from "./view/index.tsx";
import content from "./content.ts";

const router = createRouter({ logLevel: Loglevel.INFO });
const port = Deno.env()["PORT"] || "8899";
const { pathname } = new URL("./public", import.meta.url);
router.use(serveStatic(pathname));
router.get("/", async req => {
  return req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/html; charset=UTF-8"
    }),
    body: ReactDOMServer.renderToString(<Index codes={content} />)
  });
});
router.listen(":" + port);
