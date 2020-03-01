import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { FC } from "../../types/react/index.d.ts";

export const Q: FC = ({ children }) => {
  return <code className={"q"}>{children}</code>;
};
