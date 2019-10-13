import { Article } from "../components/article.tsx";
import { Code } from "../components/code.tsx";
import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { DFC } from "../../serve_jsx.ts";
import { fetchExample } from "../content.ts";
import { Content } from "../components/content.tsx";

const UseServeStatic: DFC<{ codes: { [key: string]: string } }> = ({
  codes
}) => (
  <Content>
    <Article>
      <section id={"use-serve-jsx"}>
        <h2>Host JSX file as a web page</h2>
        <p>Same as static files, JSX files can also be served as a web page.</p>
        <p />
        <Code
          href={"/example/use_serve_jsx.ts"}
          code={codes["use_serve_jsx.ts"]}
        />
        <Code
          href={"/example/pages/index.tsx"}
          code={codes["pages/index.tsx"]}
        />
      </section>
    </Article>
  </Content>
);

UseServeStatic.getInitialProps = async () => {
  const codes = Object.fromEntries(
    await Promise.all(
      ["use_serve_jsx.ts", "pages/index.tsx"].map(async v => {
        return [v, await fetchExample(v)];
      })
    )
  );
  return { codes };
};

export default UseServeStatic;
