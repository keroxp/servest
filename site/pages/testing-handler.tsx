import { Article } from "../components/article.tsx";
import { Code } from "../components/code.tsx";
import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { DFC } from "../../jsx.ts";
import { fetchExample } from "../content.ts";
import { Content } from "../components/content.tsx";
import { Q } from "../components/common.tsx";

const ServerApi: DFC<{ codes: { [key: string]: string } }> = ({ codes }) => (
  <Content>
    <Article>
      <section id={"server-api"}>
        <h2>Testing Handler</h2>
        <p>
          <Q>ResponseRecorder</Q>
          is dummy request that records response from{" "}
          <Q>HttpHandler</Q>.
        </p>
        <p>
          It behaves as an actual HTTP request for handlers and is useful for
          unit testing.
        </p>
        <Code
          href={"/example/testing_handler.ts"}
          code={codes["testing_handler.ts"]}
        />
      </section>
    </Article>
  </Content>
);

ServerApi.getInitialProps = async () => {
  const codes = Object.fromEntries(
    await Promise.all(
      ["testing_handler.ts"].map(async (v) => {
        return [v, await fetchExample(v)];
      }),
    ),
  );
  return { codes };
};

export default ServerApi;
