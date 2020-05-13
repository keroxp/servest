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
      <section id={"use-serve-jsx"}>
        <h2>Host JSX file as a web page</h2>
        <p>
          Like serving static files, JSX files can also be served as a web page.
        </p>
        <p>
          <a href={"/@/serve_jsx.ts"}>serveJsx</a>
          is built-in middleware to serve JSX files. It is similar to{" "}
          <a href={"/@/serve_static.ts"}>serveStatic</a>
          but It uses dynamic import to build a response based on JSX file.
        </p>
        <Code
          href={"/example/use_serve_jsx.ts"}
          code={codes["use_serve_jsx.ts"]}
        />
        <p>
          Here is a typical directory structure for using serveJsx along with
          serveStatic.
        </p>
        <Code
          code={`.
├── main.ts
├── pages
│   ├── about.tsx
│   └── index.tsx
└── public
    └── index.css
`}
        />
        <p>
          JSX files that served as a page must export React component as
          default. If component needs asynchronous initialization for rendering
          in server side, you should define{" "}
          <code className="q">getInitialProps</code> to the component.
        </p>
        <p>
          It is async function that returns <code className="q">
            Promise
          </code>
          {" "}
          of property type of the component. This methodology is similar to{" "}
          <a href="https://nextjs.org/">Next.js</a>
          but totally different. Component will be rendered only on the server
          side and won't be hydrated on the client side.
        </p>
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
      ["use_serve_jsx.ts", "pages/index.tsx"].map(async (v) => {
        return [v, await fetchExample(v)];
      }),
    ),
  );
  return { codes };
};

export default UseServeStatic;
