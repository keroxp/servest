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
  const v = await getServerstVersion();
  if (m) {
    const [pat] = m;
    ret = ret.replace(new RegExp(pat, "g"), `https://servestjs.org/@${v}/`);
  }
  if (ret.match("{{ServestVersion}}")) {
    ret = ret.replace(/{{ServestVersion}}/g, v);
  }
  if (ret.match("https://deno.land/std")) {
    const denov = await getDenoVersion();
    if (denov) {
      ret = ret.replace(
        /https:\/\/deno.land\/std/g,
        `https://deno.land/std@${denov}`,
      );
    }
  }
  return ret;
}

export async function fetchExampleCodes(
  ...files: string[]
): Promise<{ [key: string]: string }> {
  return Object.fromEntries(
    await Promise.all(
      files.map(async (v) => {
        return [v, await fetchExample(v)];
      }),
    ),
  );
}

let servestVersion: string | undefined;
let denoVersoin: string | undefined;
export async function getServerstVersion(): Promise<string> {
  if (servestVersion) return servestVersion;
  const v = await getLatestVersion("keroxp", "servest");
  return (servestVersion = v) ?? "";
}
export async function getDenoVersion(): Promise<string> {
  if (denoVersoin) return denoVersoin;
  const v = await getLatestVersion("denoland", "deno");
  return (denoVersoin = v) ?? "";
}
async function getLatestVersion(
  owner: string,
  repo: string,
): Promise<string | undefined> {
  const resp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
  );
  if (resp.status === 200) {
    const j = await resp.json();
    return j["name"];
  }
}
