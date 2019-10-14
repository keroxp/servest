#!/usr/bin/env deno --allow-read --allow-env --allow-run
import * as fs from "../vendor/https/deno.land/std/fs/mod.ts";
import * as path from "../vendor/https/deno.land/std/fs/path.ts";

async function main() {
  const __file = new URL(import.meta.url).pathname;
  const __dirname = path.dirname(__file);
  for await (const { filename } of fs.expandGlob(`${__dirname}/**/*.ts*`)) {
    if (!filename.endsWith(".d.ts") && filename.match(/\.tsx?$/)) {
      const { code } = await Deno.run({
        args: [Deno.execPath(), "fetch", filename]
      }).status();
      if (code !== 0) {
        Deno.exit(code || 1);
      }
    }
  }
}
main();
