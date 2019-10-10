// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import React from "./vendor/https/dev.jspm.io/react/index.js";
import ReactDOMServer from "./vendor/https/dev.jspm.io/react-dom/server.js";

import { createRouter, HttpHandler } from "../router.ts";
import { serveStatic } from "../serve_static.ts";
import { Loglevel } from "../logger.ts";
import { resolveIndexPath } from "../router_util.ts";
import { Layout } from "./components/layout.tsx";
import { pathResolver } from "../util.ts";

const port = Deno.env()["PORT"] || "8899";
const router = createRouter({ logLevel: Loglevel.INFO });
const resolve = pathResolver(import.meta.url);
router.use(serveStatic(resolve("./public")));
router.use(serveJsx(resolve("./pages")));
router.listen(":" + port);

function serveJsx(dirOrUrl: string | URL): HttpHandler {
  const dir = dirOrUrl instanceof URL ? dirOrUrl.pathname : dirOrUrl;
  return async req => {
    const { pathname } = new URL(req.url, "http://dummy");
    const p = await resolveIndexPath(dir, pathname, ".tsx");
    if (p) {
      const jsx = await import(p);
      const el = jsx.default;
      let props = {};
      if (typeof el.getInitialProps === "function") {
        props = await el.getInitialProps();
      }
      await req.respond({
        status: 200,
        headers: new Headers({
          "content-type": "text/html; charset=UTF-8"
        }),
        body: ReactDOMServer.renderToString(
          <Layout>
            {el(props)}
          </Layout>
        )
      });
    }
  };
}
