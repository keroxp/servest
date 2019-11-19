// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
function resolvePath(p: string): string {
  const u = new URL(p, import.meta.url);
  return u.pathname;
}
const encoder = new TextEncoder();

// Patch React and ReactDOMServer's type definitions based on modules.json
async function main() {
  await updateReact("@16");
  await updateReactDom("@16");
}

async function updateReact(version: string) {
  const resp = await fetch(
    `https://dev.jspm.io/@types/react${version}/index.d.ts`
  );
  let text = await resp.text();
  text = text.replace(
    '/// <reference path="global.d.ts" />',
    'import "./global.d.ts"'
  );
  text = text.replace(
    "from 'csstype'",
    "from '../../vendor/https/dev.jspm.io/csstype/index.d.ts'"
  );
  text = text.replace(
    "from 'prop-types'",
    "from '../../vendor/https/dev.jspm.io/@types/prop-types/index.d.ts'"
  );
  text = text.replace(
    "interface ReactComponentElement",
    "/* FIXME: keroxp) Broken on ts 3.7.2 2019/11/16\ninterface ReactComponentElement"
  );
  text = text.replace(
    "extends ReactElement<P, T> { }",
    "extends ReactElement<P, T> { } \n*/"
  );
  await Deno.writeFile(
    resolvePath("../types/react/index.d.ts"),
    encoder.encode(text)
  );
}

async function updateReactDom(version: string) {
  const resp = await fetch(
    `https://dev.jspm.io/@types/react-dom${version}/server/index.d.ts`
  );
  let text = await resp.text();
  text = text.replace("from 'react'", "from '../../react/index.d.ts'");
  await Deno.writeFile(
    resolvePath("../types/react-dom/server/index.d.ts"),
    encoder.encode(text)
  );
}

if (import.meta.main) {
  main();
}
