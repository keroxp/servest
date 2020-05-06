#!/usr/bin/env deno run --allow-read --allow-run --allow-env
async function main() {
  if (Deno.args.length < 2) {
    console.error(`
deno-dev: watch files and restart process if any file changed.
    
USAGE: 
  dev.ts ...[GLOB_PATTERNS] [RESTART_COMMAND}
  
EXAMPLE: 
  dev.ts site/ main.ts
  
    `);
    Deno.exit(1);
  }
  const paths = Deno.args.slice(0, Deno.args.length - 1);
  const cmd = Deno.args[Deno.args.length - 1];
  let proc: Deno.Process;
  let replacing = false;
  function replaceProcess() {
    if (proc) {
      console.log(`Restarting...`);
      proc.close();
    }
    proc = Deno.run({ cmd: [cmd] });
  }
  async function watch() {
    for await (const ev of Deno.watchFs(paths)) {
      if (ev.kind == "modify" || ev.kind == "create" || ev.kind == "remove") {
        const paths = ev.paths.filter((p) =>
          !!p.match(/\.tsx?$/) && !p.endsWith(".d.ts")
        );
        if (paths.length == 0) continue;
        const compile = Deno.run({ cmd: [Deno.execPath(), "cache", ...paths] });
        const { code } = await compile.status();
        if (code === 0) {
          replaceProcess();
        }
      }
    }
  }
  console.log(`Starting...`);
  replaceProcess();
  watch();
}
main();
