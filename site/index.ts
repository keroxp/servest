// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { createRouter } from "../router.ts";
import { serveStatic } from "../serve_static.ts";
import { Loglevel } from "../logger.ts";

const router = createRouter({ logLevel: Loglevel.INFO });
const port = Deno.env()["PORT"] || "8899";
const { pathname } = new URL("./public", import.meta.url);
router.handle("/", serveStatic(pathname));
router.get("/throw", () => {
  throw new Error("error");
});
router.listen(":" + port);
