import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { Content } from "../components/content.tsx";
import { Article } from "../components/article.tsx";
import { Code } from "../components/code.tsx";
import { DFC } from "../../serve_jsx.ts";
import { fetchExaple } from "../content.ts";
import {ServestVersion} from "../../version.ts";

const GetStarted: DFC<{
  codes: {[key: string]: string}
}> = ({ codes }) => (
  <Content>
    <Article>
      <section id={"get-started"}>
        <h2>Get Started</h2>
        <p>
          Servest is a suite of HTTP/1.1 modules. There are three major API for handling HTTP stuffs.
        </p>
        <Code href={"/examples/get_started.ts"} code={codes["get_started.ts"]} />
      </section>
      <section id={"router-api"}>
        <h2>Router API</h2>
        <p>
          Router API is high level HTTP interface for building general purpose http servers.
          It is highly affected by <a href={"http://expressjs.com"}>Express</a> from <a href={"https://nodejs.org"}>Node.js</a>.
          Router maps route with handler. Handler will be called for each request matched to given pattern.
        </p>
        <Code href={"/examples/routing_server.ts"} code={codes["routing_server.ts"]} />
      </section>
      <section id={"installation"}>
        <h2>Installation</h2>
        <p>
          Servest is hosted by <a href="/">https://servestjs.org</a> based on Github's source codes.
          <ul>
            <li>
              <b>Latest</b>: <a href={"/@/server.ts"}>https://servestjs.org/@/server.ts</a>
            </li>
            <li>
              <b>Versioned</b>: <a href={`/@${ServestVersion}/server.ts`}>https://servestjs.org/@{ServestVersion}/server.ts</a>
            </li>
          </ul>
        </p>
      </section>
    </Article>
  </Content>
);
GetStarted.getInitialProps = async () => {
  const [getStarted, routingServer] = await Promise.all([
    fetchExaple("get_started.ts"),
    fetchExaple("routing_server.ts")
  ]);
  return {
    codes: {
      "get_started.ts": getStarted,
      "routing_server.ts": routingServer
    }
  };
};
export default GetStarted;
