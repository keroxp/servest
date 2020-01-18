#!/usr/bin/env deno --allow-read --allow-run --allow-env
import * as fs from "../vendor/https/deno.land/std/fs/mod.ts";
import FileInfo = Deno.FileInfo;

let fileStates = new Map<string, FileInfo>();
let watching = false;
async function watch(...globs: string[]): Promise<string[]> {
  let changed: string[] = [];
  for (const glob of globs) {
    for await (const { filename, info } of fs.expandGlob(glob)) {
      if (!watching) {
        fileStates.set(filename, info);
      } else {
        const prevInfo = fileStates.get(filename);
        fileStates.set(filename, info);
        if (prevInfo && info.modified && prevInfo.modified) {
          if (info.modified > prevInfo.modified) {
            console.log(`${filename} changed.`);
            changed.push(filename);
          }
        } else if (!prevInfo) {
          changed.push(filename);
        }
      }
    }
  }
  watching = true;
  return changed;
}

async function main() {
  if (Deno.args.length < 3) {
    console.error(`
deno-dev: watch files and restart process if any file changed.
    
USAGE: 
  dev.ts ...[GLOB_PATTERNS] [RESTART_COMMAND}
  
EXAMPLE: 
  dev.ts '**/*.ts' '**/*.tsx' 'main.ts'
  
    `);
    Deno.exit(1);
  }
  const globs = Deno.args.slice(0, Deno.args.length - 1);
  const cmd = Deno.args[Deno.args.length - 1];
  let proc: Deno.Process;
  function replaceProcess() {
    if (proc) {
      console.log(`Restarting...`);
      proc.close();
    }
    proc = Deno.run({ args: [cmd] });
  }
  setInterval(async () => {
    const files = await watch(...globs);
    if (files.length > 0) {
      let errored = false;
      for (const file of files) {
        const compile = Deno.run({ args: [Deno.execPath(), "fetch", file] });
        const { code } = await compile.status();
        if (code !== 0) {
          errored = true;
        }
      }
      if (!errored) {
        replaceProcess();
      }
    }
  }, 1000);
  console.log(`Starting...`);
  replaceProcess();
}
main();
