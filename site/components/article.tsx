import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { FC } from "../../types/react/index.d.ts";

export const Article: FC = ({ children }) => (
  <article className="article">{children}</article>
);
