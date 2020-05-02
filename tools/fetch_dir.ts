#!/usr/bin/env deno -A
import * as fs from "../vendor/https/deno.land/std/fs/mod.ts";
import * as path from "../vendor/https/deno.land/std/path/mod.ts";
export async function fetchDir(dir: string): Promise<number> {
  let codes: string[] = [];
  const glob = path.join(dir, "**/*.ts*");
  for await (const f of fs.expandGlob(glob)) {
    if (!f.path.endsWith(".d.ts") && f.path.match(/\.tsx?$/)) {
      console.log(f.path);
      codes.push('import "' + f.path + '"');
    }
  }
  const encoder = new TextEncoder();
  const tempDir = await Deno.makeTempDir({ prefix: "servest" });
  const tempFile = path.resolve(tempDir, "_mod.ts");
  await Deno.writeFile(tempFile, encoder.encode(codes.join("\n")));
  const proc = await Deno.run({
    cmd: [Deno.execPath(), "cache", path.resolve(tempFile)],
  });
  const { code } = await proc.status();
  await Deno.remove(tempDir, { recursive: true });
  return code === undefined ? 1 : code;
}

async function main() {
  const code = await fetchDir(Deno.args[0]);
  Deno.exit(code);
}

if (import.meta.main) {
  main();
}
