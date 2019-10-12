import React from "../../vendor/https/dev.jspm.io/react/index.js";

export type CodeState = {
  title: string;
  href: string;
  id: string;
  code: string;
};

export const Code: React.FC<CodeState> = ({ id, title, code, href }) => {
  const { pathname } = new URL(href, "https://dummy");
  const basename = pathname.split("/").pop();
  return (
    <div id={id}>
      <h2>{title}</h2>
      <div className="codeLink">
        <a href={href} target="_blank">
          {basename}
        </a>
      </div>
      <pre>
        <code className="ts">{code}</code>
      </pre>
    </div>
  );
};
