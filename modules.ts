#!/usr/bin/env deno --allow-write
import * as path from "https://deno.land/std@v0.17.0/fs/path.ts";

const modules = {
  "https://deno.land/std": {
    version: "@v0.17.0",
    modules: [
      "/testing/mod.ts",
      "/testing/asserts.ts",
      "/textproto/mod.ts",
      "/io/bufio.ts",
      "/io/readers.ts",
      "/io/writers.ts",
      "/strings/decode.ts",
      "/strings/encode.ts"
    ]
  }
};

async function ensure() {
  const encoder = new TextEncoder();
  for (const [k, v] of Object.entries(modules)) {
    const url = new URL(k);
    const { protocol, hostname, pathname } = url;
    const scheme = protocol.slice(0, protocol.length - 1);
    const dir = path.join("./vendor", scheme, hostname, pathname);
    const writeLinkFile = async (mod: string) => {
      const modFile = `${dir}${mod}`;
      const modDir = path.dirname(modFile);
      await Deno.mkdir(modDir, true);
      const specifier = `${k}${v.version}${mod}`;
      const link = `export * from "${specifier}";`;
      const f = await Deno.open(modFile, "w");
      await Deno.write(f.rid, encoder.encode(link));
      console.log(`Linked: ${specifier}`);
    };
    await Promise.all(v.modules.map(writeLinkFile));
  }
}
ensure();
