import React from "../vendor/https/dev.jspm.io/react/index.js";
import * as path from "../vendor/https/deno.land/std/fs/path.ts";

export type CodeState = {
  title: string;
  href: string;
  id: string;
  code: string;
};

export const Code = ({ id, title, code, href }: CodeState) => {
  return (
    <div id={id}>
      <h2>{title}</h2>
      <div class="codeLink">
        <a href={href} target="_blank">
          {path.basename(href)}
        </a>
      </div>
      <pre>
        <code class="ts">{code}</code>
      </pre>
    </div>
  );
};
