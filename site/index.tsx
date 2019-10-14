// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { createRouter } from "../router.ts";
import { serveStatic } from "../serve_static.ts";
import { Loglevel } from "../logger.ts";
import { Layout } from "./components/layout.tsx";
import { pathResolver } from "../util.ts";
import { serveJsx } from "../serve_jsx.ts";
import { RoutingError } from "../error.ts";

const port = Deno.env()["PORT"] || "8899";
const router = createRouter({ logLevel: Loglevel.INFO });
const resolve = pathResolver(import.meta);
router.use(serveStatic(resolve("./public")));
router.use(serveJsx(resolve("./pages"), Layout));
router.get(new RegExp("^/@(?<version>.*?)/(?<pathname>.+?)$"), async req => {
  let { version, pathname } = req.match.groups;
  if (!version) {
    version = "master";
  }
  const u = `https://raw.githubusercontent.com/keroxp/servest/${version}/${pathname}`;
  await fetch(u).then(req.respond);
});
router.handleError(async (e, req) => {
  if (e instanceof RoutingError) {
    const body = await Deno.open(resolve("./public/error.html"), "r");
    await req
      .respond({
        status: e.status,
        headers: new Headers({
          "content-type": "text/html; charset=UTF-8"
        }),
        body
      })
      .finally(() => body.close());
  }
});
router.listen(":" + port);
