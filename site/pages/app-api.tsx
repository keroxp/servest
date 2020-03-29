import { Article } from "../components/article.tsx";
import { Code } from "../components/code.tsx";
import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { DFC } from "../../jsx.ts";
import { fetchExample } from "../content.ts";
import { Content } from "../components/content.tsx";

const AppApi: DFC<{ codes: { [key: string]: string } }> = ({ codes }) => (
  <Content>
    <Article>
      <section id={"app-api"}>
        <h2>App API</h2>
        <p>
          App API is high level HTTP interface for building general purpose
          http servers. It is highly affected by{" "}
          <a href={"http://expressjs.com"}>Express</a> from{" "}
          <a href={"https://nodejs.org"}>Node.js</a>. Router maps route with
          handler. Handler will be called for each request matched to given
          pattern.
        </p>
        <Code
          href={"/example/app_server.ts"}
          code={codes["app_server.ts"]}
        />
      </section>
    </Article>
  </Content>
);

AppApi.getInitialProps = async () => {
  const codes = Object.fromEntries(
    await Promise.all(
      ["app_server.ts"].map(async (v) => {
        return [v, await fetchExample(v)];
      }),
    ),
  );
  return { codes };
};

export default AppApi;
