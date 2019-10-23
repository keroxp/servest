import { pathResolver } from "../util.ts";
import * as path from "../vendor/https/deno.land/std/path/mod.ts";
import { ServestVersion } from "../version.ts";

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
    ret = ret.replace(
      new RegExp(pat, "g"),
      `https://servestjs.org/@${ServestVersion}/`
    );
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
