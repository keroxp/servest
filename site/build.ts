import hljs from "https://dev.jspm.io/highlight.js";
// import ts from "https://dev.jspm.io/highlight.js/lib/languages/typescript.js"
const ret = hljs.highlight("ts", "const a = 1;");
const resolve = path => {
  return new URL(path, import.meta.url).pathname;
};
async function main() {
  const list = [
    "example/error_handler.ts",
    "example/get_started.ts",
    "example/routing_server.ts",
    "example/simple_server.ts",
    "example/use_middleware.ts"
  ];
  const decoder = new TextDecoder();
  let temp = decoder.decode(
    await Deno.readFile(resolve("./public/index.tmp.html"))
  );
  for (const e of list) {
    const f = await Deno.readFile(resolve("./public/" + e));
    const v = decoder.decode(f);
    const hl = hljs.highlight("ts", v);
    temp = temp.replace(
      `{{ ${e} }}`,
      `
<pre>
<code class="ts hljs javascript">
${hl.value}
</code>
</pre> 
    `
    );
  }
  console.log(temp);
}
main();
