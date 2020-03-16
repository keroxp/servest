import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { Article } from "../components/article.tsx";
import { Code } from "../components/code.tsx";
import { DFC } from "../../jsx.ts";
import { fetchExample } from "../content.ts";
import { Content } from "../components/content.tsx";

const AgentApi: DFC<{ codes: { [key: string]: string } }> = ({ codes }) =>
  (
    <Content>
      <Article>
        <section id={"agent-api"}>
          <h2>Agent API</h2>
          <p>
            Agent API is low level interface for managing HTTP/1.1 Keep-Alive
                      connection to the host.
          </p>
          <p>
            It is the persist HTTP client to the same host and can be used as a
                      connection pool. In most cases,{" "}
            <a
              href={"https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API"}
            >
              fetch
            </a>
            {" "}
            is enough for sending HTTP request but is useful to manage Keep-Alive
                      connections.
          </p>
          <Code
            href={"/example/create_agent.ts"}
            code={codes["create_agent.ts"]}
          />
        </section>
      </Article>
    </Content>
  );

AgentApi.getInitialProps = async () => {
  const codes = Object.fromEntries(
    await Promise.all(
      ["create_agent.ts"].map(async v => {
        return [v, await fetchExample(v)];
      })
    )
  );
  return { codes };
};

export default AgentApi;
