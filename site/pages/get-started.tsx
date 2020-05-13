import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { Content } from "../components/content.tsx";
import { Article } from "../components/article.tsx";
import { Code } from "../components/code.tsx";
import { DFC } from "../../jsx.ts";
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
        <p>
          If you want to build HTTP server anyway,{" "}
          <a href={"/router-api"}>Router API</a>
          is the best choice. Router API provides a high-level interfaces for
          building general purpose HTTP server (site, application, api or file
          server ...etc).
        </p>
        <Code href={"/example/get_started.ts"} code={codes["get_started.ts"]} />
        <Code
          lang={"bash"}
          code={`$ deno --allow-net https://servestjs.org/example/get_started.ts`}
        />
      </section>
      <section>
        <h2>Advanced API</h2>
        <p>
          If you are familiar with HTTP/1.1 protocol and programing TCP
          server,{" "}
          <a href={"/server-api"}>Server API</a> and{" "}
          <a href={"/agent-api"}>Agent API</a>
          may be useful for building customized HTTP libraries.
        </p>
      </section>
    </Article>
  </Content>
);
GetStarted.getInitialProps = async () => {
  const codes = Object.fromEntries(
    await Promise.all(
      ["get_started.ts"].map(async (v) => {
        return [v, await fetchExample(v)];
      }),
    ),
  );
  return { codes };
};
export default GetStarted;
