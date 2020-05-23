import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { FC } from "../../types/react/index.d.ts";
import { Version } from "../../_version.ts";

export const DocLink: FC<{
  file?: string;
  children: string;
}> = ({ file = "mod.ts", children }) => (
  <a
    target="_blank"
    href={`https://doc.deno.land/https/servestjs.org/@${Version}/${file}#${children}`}
  >
    {children}
  </a>
);
