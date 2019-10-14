#!/usr/bin/env deno --allow-read --allow-env --allow-run
import * as fs from "../vendor/https/deno.land/std/fs/mod.ts";
import * as path from "../vendor/https/deno.land/std/fs/path.ts";
import * as flags from "../vendor/https/deno.land/std/flags/mod.ts";
async function main() {
  const __file = new URL(import.meta.url).pathname;
  const __dirname = path.dirname(__file);
  const f = flags.parse(Deno.args, {
    "--": true,
    alias: {
      p: "pages"
    }
  });
  let dir = `${__dirname}/**/*.ts*`;
  if (f["p"]) {
    dir = `${__dirname}/pages/**/*.tsx`;
  }
  for await (const { filename } of fs.expandGlob(dir)) {
    if (!filename.endsWith(".d.ts") && filename.match(/\.tsx?$/)) {
      console.log(filename);
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
