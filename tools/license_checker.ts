#!/usr/bin/env deno run --allow-read
import * as fs from "../vendor/https/deno.land/std/fs/expand_glob.ts";
import * as path from "../vendor/https/deno.land/std/path/mod.ts";
import * as tp from "../vendor/https/deno.land/std/textproto/mod.ts";
import { BufReader } from "../vendor/https/deno.land/std/io/bufio.ts";
const dec = new TextDecoder();
const opts = JSON.parse(dec.decode(Deno.readFileSync(".licenserc.json")));
const ignore: string[] = opts["ignore"];
delete opts["ignore"];
async function readLine(f: Deno.Reader): Promise<string | null> {
  const bufr = BufReader.create(f);
  const tpr = new tp.TextProtoReader(bufr);
  let line = await tpr.readLine();
  if (line === null) {
    return line;
  }
  line = line.trimStart();
  if (line.startsWith("#!")) {
    return readLine(bufr);
  }
  return line;
}
let code = 0;
for (const [key, val] of Object.entries(opts)) {
  const files = [...fs.expandGlobSync(key)]
    .map((v) => path.relative(".", v.path))
    .filter((v) => !ignore.some((i) => v.startsWith(i)));
  for (const file of files) {
    const f = Deno.openSync(file);
    const line = await readLine(f);
    if (line == null) {
      throw new Error("unexpected EOF: " + file);
    }
    if (line !== val) {
      console.error(`ERR: ${file}`);
      code = 1;
    }
  }
}
if (code === 0) {
  console.log("OK");
}
Deno.exit(code);
