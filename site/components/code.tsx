import React from "../../vendor/https/dev.jspm.io/react/index.js";

export type CodeState = {
  href: string;
  code: string;
};

export const Code: React.FC<CodeState> = ({ code, href }) => {
  const { pathname } = new URL(href, "https://dummy");
  const basename = pathname.split("/").pop();
  return (
    <div className="code">
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
