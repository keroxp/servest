import { Article } from "../components/article.tsx";
import { Code } from "../components/code.tsx";
import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { DFC } from "../../serve_jsx.ts";
import { fetchExample } from "../content.ts";
import { Content } from "../components/content.tsx";

const ServeApi: DFC<{ codes: { [key: string]: string } }> = ({ codes }) => (
  <Content>
    <Article>
      <section id={"serve-api"}>
        <h2>Serve API</h2>
        <p>
          Serve API is low level HTTP interface for building customized HTTP
          server.
        </p>
        <p>
          All HTTP requests connected to the address will be passed to callback
          function. Serve API automatically manages Keep-Alive connection and
          process requests from same connection serially.
        </p>
        <Code
          href={"/example/simple_server.ts"}
          code={codes["simple_server.ts"]}
        />
      </section>
    </Article>
  </Content>
);

ServeApi.getInitialProps = async () => {
  const codes = Object.fromEntries(
    await Promise.all(
      ["simple_server.ts"].map(async v => {
        return [v, await fetchExample(v)];
      })
    )
  );
  return { codes };
};

export default ServeApi;
