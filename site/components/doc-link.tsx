import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { FC } from "../../types/react/index.d.ts";
import { version } from "../content.ts";

export const DocLink: FC<{ children: string }> = ({ children }) => (
  <a
    target="_blank"
    href={`https://doc.deno.land/https/servestjs.org/@${version()}/mod.ts#${children}`}
  >
    {children}
  </a>
);
