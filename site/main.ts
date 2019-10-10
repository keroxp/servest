#!/usr/bin/env deno --allow-net --allow-read --allow-env
import { pathResolver } from "../util.ts";
const resolve = pathResolver(import.meta.url);
async function main() {
  const pages = await Deno.readDir(resolve("./pages").pathname);
  // load components
  await Promise.all(
    pages.map(v => {
      if (v.name) {
        return import(resolve("./pages/" + v.name).toString());
      }
    })
  );
  import(resolve("./index.tsx").toString());
}
main();
