// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { pathResolver } from "../util.ts";
import * as path from "../vendor/https/deno.land/std/path/mod.ts";

const decoder = new TextDecoder();
const resolve = pathResolver(import.meta);
export async function fetchExample(filename: string): Promise<string> {
  const p = resolve("./public/example/" + filename);
  const b = await Deno.readFile(p);
  const relative = path.relative(p, resolve("../"));
  const m = relative.match(/(..\/)+/);
  let ret = decoder.decode(b);
  if (m) {
    const [pat] = m;
    const v = await getLatestVersion();
    ret = ret.replace(new RegExp(pat, "g"), `https://servestjs.org/@${v}/`);
  }
  return ret;
}

export async function fetchExampleCodes(
  ...files: string[]
): Promise<{ [key: string]: string }> {
  return Object.fromEntries(
    await Promise.all(
      files.map(async v => {
        return [v, await fetchExample(v)];
      })
    )
  );
}

let LatestVersion: string = "";
export async function getLatestVersion() {
  if (LatestVersion) return LatestVersion;
  const resp = await fetch(
    "https://api.github.com/repos/keroxp/servest/releases/latest"
  );
  if (resp.status === 200) {
    const j = await resp.json();
    LatestVersion = j["name"];
  }
  return LatestVersion;
}
