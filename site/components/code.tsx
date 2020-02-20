import React from "../../vendor/https/dev.jspm.io/react/index.js";

export type CodeState = {
  href?: string;
  code: string;
};

export const Code: React.FC<CodeState & {
  lang?: string;
}> = ({ code, href, lang }) => {
  let cls = "";
  let basename: string | undefined;
  if (href) {
    const { pathname } = new URL(href, "https://dummy");
    basename = pathname.split("/").pop()!;
    cls =
      basename.endsWith("jsx") || basename.endsWith("tsx") ? "jsx" : "ts";
  }
  return (
    <div className="codeWindow">
      <div className="codeWindowHeader">
        <div className="codeWindowButtonWrapper">
          <div className="codeWindowButton codeWindowRedButton" />
          <div className="codeWindowButton codeWindowYellowButton" />
          <div className="codeWindowButton codeWindowGreenButton" />
        </div>
        <div className="codeLink">
          {href && (
            <a href={href} target="_blank">
              {basename}
            </a>
          )}
        </div>
        <div />
      </div>
      <pre className="codeWrapper">
        <code className={`codeInner language-${lang || cls}`}>{code}</code>
      </pre>
    </div>
  );
};
