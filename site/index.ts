#!/usr/bin/env deno --allow-net --allow-read --allow-env
// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { serveStatic } from "../serve_static.ts";
import { Loglevel } from "../logger.ts";
import { Layout } from "./components/layout.tsx";
import { pathResolver } from "../util.ts";
import { serveJsx } from "../serve_jsx.ts";
import { RoutingError } from "../error.ts";
import { createApp } from "../app.ts";

const router = createApp({ logLevel: Loglevel.INFO });
const resolve = pathResolver(import.meta);
router.use(serveStatic(resolve("./public")));
router.use(serveJsx(resolve("./pages"), f => import(f), Layout));
router.get(new RegExp("^/@(?<version>.*?)/(?<pathname>.+?)$"), async req => {
  let { version, pathname } = req.match.groups!;
  if (!version) {
    version = "master";
  }
  const u =
    `https://raw.githubusercontent.com/keroxp/servest/${version}/${pathname}`;
  const resp = await fetch(u);
  if (resp.status === 200) {
    await req.respond(resp);
  } else if (resp.status === 404) {
    throw new RoutingError(404);
  } else {
    throw new Error(await resp.body.text());
  }
});
router.catch(async (e, req) => {
  if (e instanceof RoutingError) {
    await req.sendFile(resolve("./public/error.html"));
  }
});
const port = Deno.env()["PORT"] || "8899";
router.listen(":" + port);
