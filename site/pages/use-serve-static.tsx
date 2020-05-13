import { Article } from "../components/article.tsx";
import { Code } from "../components/code.tsx";
import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { DFC } from "../../jsx.ts";
import { fetchExample } from "../content.ts";
import { Content } from "../components/content.tsx";

const UseServeStatic: DFC<{ codes: { [key: string]: string } }> = ({
  codes,
}) => (
  <Content>
    <Article>
      <section id={"use-serve-static"}>
        <h2>Host static files</h2>
        <p>
          <a href={"/@/serve_static.ts"}>serve_static.ts</a>
          is a built-in middleware for hosting static files (html, image,
          stylesheets and more).
        </p>
        <p>
          In the example below, all files in <code className="q">
            ./public
          </code>
          {" "}
          directories are automatically served if request path matches file. For
          instance, <code className="q">./public/index.css</code>
          will be served as <code className="q">
            http://example.com/index.css
          </code>.
        </p>
        <p>
          If no files found on requested path, request will be passed into the
          next middleware.
        </p>
        <Code
          href={"/example/use_serve_static.ts"}
          code={codes["use_serve_static.ts"]}
        />
      </section>
    </Article>
  </Content>
);

UseServeStatic.getInitialProps = async () => {
  const codes = Object.fromEntries(
    await Promise.all(
      ["use_serve_static.ts"].map(async (v) => {
        return [v, await fetchExample(v)];
      }),
    ),
  );
  return { codes };
};

export default UseServeStatic;
