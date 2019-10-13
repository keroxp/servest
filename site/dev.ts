import * as fs from "../vendor/https/deno.land/std/fs/mod.ts";
import FileInfo = Deno.FileInfo;

let fileStates = new Map<string, FileInfo>();
let watching = false;
async function watch(glob: string): Promise<string[]> {
  if (!watching) {
    for await (const { filename, info } of fs.expandGlob(glob)) {
      fileStates.set(filename, info);
    }
    watching = true;
    return [];
  }
  let changed: string[] = [];
  for await (const { filename, info } of fs.expandGlob(glob)) {
    const prevInfo = fileStates.get(filename);
    fileStates.set(filename, info);
    if (prevInfo && info.modified && prevInfo.modified) {
      if (info.modified > prevInfo.modified) {
        console.log(`${filename} changed.`);
        changed.push(filename);
      }
    } else if (!prevInfo) {
      changed.push(filename)
    }
  }
  return changed;
}

async function main() {
  const glob = Deno.args[1];
  const args = Deno.args.slice(2);
  console.log(glob, args);
  let proc: Deno.Process;
  function replaceProcess() {
    if (proc) {
      console.log(`Restarting...`);
      proc.close();
    }
    proc = Deno.run({ args });
  }
  setInterval(async () => {
    const files = await watch(glob);
    if (files.length > 0) {
      const compile = Deno.run({args: [Deno.execPath(), "fetch", ...files]});
      const {code} = await compile.status();
      if (code === 0) {
        replaceProcess();
      }
    }
  }, 1000);
  console.log(`Starting...`);
  replaceProcess();
}
main();
