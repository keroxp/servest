import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { DFC } from "../../serve_jsx.ts";
import { Code } from "../components/code.tsx";
import { fetchExample } from "../content.ts";

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
        <div className="welcomeCode">
          <Code href={"/example/use_jsx.tsx"} code={codes["use_jsx.tsx"]} />
        </div>
      </div>
    </div>
  );
};

Index.getInitialProps = async () => {
  const codes = Object.fromEntries(
    await Promise.all(
      ["use_jsx.tsx"].map(async v => {
        return [v, await fetchExample(v)];
      })
    )
  );
  return { codes };
};

export default Index;
