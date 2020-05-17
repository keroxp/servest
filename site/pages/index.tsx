import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { DFC } from "../../jsx.ts";
import { Code } from "../components/code.tsx";
import { fetchExample } from "../content.ts";
import { SideBarContent } from "../components/content.tsx";

const Index: DFC<{
  codes: {
    [key: string]: string;
  };
}> = ({ codes }) => {
  return (
    <div className="root">
      <div className="indexHead">
        <div className="indexHeadInner">
          <h1>Servest</h1>
          <p className="subTitle">A progressive http server for Deno</p>
          <div className={"subButtons"}>
            <a className="startButton" href={"/get-started"}>
              Get Started
            </a>
          </div>
        </div>
      </div>
      <div className="index">
        <section className="">
          <h2>High Compatibility with std/http</h2>
          <p>
            Servest has similar api to <a
              href="https://deno.land/std/http"
              target="_blacnk"
            >
              std/http
            </a>. Easy to migrate your code into servest.
          </p>
          <div className="codeComparison">
            <div>
              <h3>std/http</h3>
              <Code
                href={"/example/comparison/std_http.ts"}
                code={codes["comparison/std_http.ts"]}
              />
            </div>
            <div>
              <h3>servest</h3>
              <Code
                href={"/example/comparison/servest.ts"}
                code={codes["comparison/servest.ts"]}
              />
            </div>
          </div>
        </section>
        <section className="">
          <h2>Built-in jsx support</h2>
          <p>
            Servest supports jsx/tsx with zero configurations.
          </p>
          <Code href={"/example/use_jsx.tsx"} code={codes["use_jsx.tsx"]} />
        </section>
      </div>
      <div className="mobileOnly">
        <SideBarContent />
      </div>
    </div>
  );
};

Index.getInitialProps = async () => {
  const codes = Object.fromEntries(
    await Promise.all(
      ["use_jsx.tsx", "comparison/std_http.ts", "comparison/servest.ts"].map(
        async (v) => {
          return [v, await fetchExample(v)];
        },
      ),
    ),
  );
  return { codes };
};

export default Index;
