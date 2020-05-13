import { Article } from "../components/article.tsx";
import { Code } from "../components/code.tsx";
import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { DFC } from "../../jsx.ts";
import { fetchExample } from "../content.ts";
import { Content } from "../components/content.tsx";
import { Q } from "../components/common.tsx";
import { DocLink } from "../components/doc-link.tsx";

const RouterApi: DFC<{ codes: { [key: string]: string } }> = ({ codes }) => (
  <Content>
    <Article>
      <section id={"router-api"}>
        <h2>Use router</h2>
        <p>
          <DocLink>Router</DocLink> is a set of routes and handlers.
          <DocLink>App</DocLink>
          {" "}is also Router.
        </p>
        <p>There are two difference between App and Router</p>
        <ul>
          <li>
            App never throws error while processing request. All requests that
            caused error and not responded will be captured and correctly
            finalized.
          </li>
          <li>
            Router has no <Q>listen()</Q> method so it can't be started by self.
          </li>
        </ul>
        <p>
          Router is used to by passing to <Q>router.route()</Q>. Different from
          <Q>router.handle()</Q>
          <Q>route()</Q> accept only string prefix for matching prefix of route.
        </p>
        <Code
          href={"/example/use_router.ts"}
          code={codes["use_router.ts"]}
        />
      </section>
    </Article>
  </Content>
);

RouterApi.getInitialProps = async () => {
  const codes = Object.fromEntries(
    await Promise.all(
      ["use_router.ts"].map(async (v) => {
        return [v, await fetchExample(v)];
      }),
    ),
  );
  return { codes };
};

export default RouterApi;
