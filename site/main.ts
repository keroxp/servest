#!/usr/bin/env deno --allow-net --allow-read --allow-env
import { pathResolver } from "../util.ts";
import { createServer } from "./index.ts";
const resolve = pathResolver(import.meta);
async function main() {
  const pages = await Deno.readDir(resolve("./pages"));
  // load components
  await Promise.all(
    pages.map(v => {
      if (v.name) {
        return import(resolve("./pages/" + v.name).toString());
      }
    })
  );
  const port = Deno.env()["PORT"] || "8899";
  const router = createServer();
  router.listen(":" + port);
}
main();
