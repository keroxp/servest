import * as fs from "../vendor/https/deno.land/std/fs/mod.ts";
import FileInfo = Deno.FileInfo;

let fileStates = new Map<string, FileInfo>();
let watching = false;
async function watch(glob: string): Promise<boolean> {
  if (!watching) {
    for await (const { filename, info } of fs.expandGlob(glob)) {
      fileStates.set(filename, info);
    }
    watching = true;
    return false;
  }
  let changed = false;
  for await (const { filename, info } of fs.expandGlob(glob)) {
    const prevInfo = fileStates.get(filename);
    fileStates.set(filename, info);
    if (prevInfo && info.modified && prevInfo.modified) {
      if (info.modified > prevInfo.modified) {
        console.log(`${filename} changed.`);
        changed = true;
      }
    } else if (!prevInfo) {
      changed = true;
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
    if (await watch(glob)) {
      replaceProcess();
    }
  }, 1000);
  console.log(`Starting...`);
  replaceProcess();
}
main();
