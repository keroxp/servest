import { Article } from "../components/article.tsx";
import { Code } from "../components/code.tsx";
import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { DFC } from "../../jsx.ts";
import { fetchExample } from "../content.ts";
import { Content } from "../components/content.tsx";

const UseJsx: DFC<{ codes: { [key: string]: string } }> = ({ codes }) => (
  <Content>
    <Article>
      <section id={"use-jsx"}>
        <h2>Use JSX as a template</h2>
        <p>
          Deno has a built-in{" "}
          <a href={"https://reactjs.org/docs/introducing-jsx.html"}>JSX</a>{" "}
          support powered by TypeScript.
        </p>
        <p>
          By default, JSX files (<code className="q">.jsx</code>,{" "}
          <code className="q">.tsx</code>) will be transformed by{" "}
          <code className="q">
            React.createElement()
          </code>. So you must import React on the head of your jsx file.
        </p>
        <p>
          React is developed in Node.js and Browser ecosystem and there are no
          official ESM-based distribution. We recommend you get React for deno
          from{" "}
          <a href="https://jspm.io">
            https://jspm.io
          </a>, which is ESModule CDN for CommonJS.
        </p>
        <p>
          React is written by pure JavaScript and has no type definition by
          default. Optionally, you can use type definitions for React by
          annotating import statement with{" "}
          <code className="q">
            @deno-types
          </code>. This is Deno's extension method for mapping JavaScript file
          and type definition. You can find more detail information on{" "}
          <a
            href={"https://deno.land/manual.html#usingexternaltypedefinitions"}
          >
            the official manual
          </a>
          .
        </p>
        <p>
          Unfortunately, there are no pure ESM type definitions for React 😇. So
          we are providing patched type definitions for Deno.
          <ul>
            <li>
              <b>React</b>:{" "}
              <a href={"/@/types/react/index.d.ts"}>
                https://servestjs.org/@/types/react/index.d.ts
              </a>
            </li>
            <li>
              <b>ReactDOMServer</b>:{" "}
              <a href={"/@/types/react-dom/server/index.d.ts"}>
                https://servestjs.org/@/types/react-dom/server/index.d.ts
              </a>
            </li>
          </ul>
        </p>
        <p>Here is the most essential example to use JSX with Servest.</p>
        <Code href={"/example/use_jsx.tsx"} code={codes["use_jsx.tsx"]} />
      </section>
    </Article>
  </Content>
);

UseJsx.getInitialProps = async () => {
  const codes = Object.fromEntries(
    await Promise.all(
      ["use_jsx.tsx"].map(async (v) => {
        return [v, await fetchExample(v)];
      }),
    ),
  );
  return { codes };
};

export default UseJsx;
