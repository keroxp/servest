import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { Content } from "../components/content.tsx";
import { Article } from "../components/article.tsx";
import { Code } from "../components/code.tsx";
import { DFC } from "../../serve_jsx.ts";
import { fetchExample } from "../content.ts";

const GetStarted: DFC<{
  codes: { [key: string]: string };
}> = ({ codes }) => (
  <Content>
    <Article>
      <section id={"get-started"}>
        <h2>Get Started</h2>
        <p>
          Servest is a suite of HTTP/1.1 modules. There are three major API for
          handling HTTP stuffs.
        </p>
        <Code href={"/example/get_started.ts"} code={codes["get_started.ts"]} />
      </section>
    </Article>
  </Content>
);
GetStarted.getInitialProps = async () => {
  const codes = Object.fromEntries(
    await Promise.all(
      ["get_started.ts"].map(async v => {
        return [v, await fetchExample(v)];
      })
    )
  );
  return { codes };
};
export default GetStarted;
