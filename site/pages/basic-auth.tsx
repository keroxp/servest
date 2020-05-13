import { Article } from "../components/article.tsx";
import { Code } from "../components/code.tsx";
import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { DFC } from "../../jsx.ts";
import { fetchExample } from "../content.ts";
import { Content } from "../components/content.tsx";
import { Q } from "../components/common.tsx";

const BasicAuth: DFC<{ codes: { [key: string]: string } }> = ({ codes }) => (
  <Content>
    <Article>
      <section id={"basic-auth"}>
        <h2>Basic Auth</h2>
        <p>
          Servest provides Basic Aauth (
          <a href="https://tools.ietf.org/html/rfc7617" target="_blank">
            RFC7617
          </a>
          ) middleware by official. Add <Q>hasicAuth()</Q>
          middleware into your router or routes.
        </p>
        <Code href={"/example/basic_auth.ts"} code={codes["basic_auth.ts"]} />
      </section>
    </Article>
  </Content>
);

BasicAuth.getInitialProps = async () => {
  const codes = Object.fromEntries(
    await Promise.all(
      ["basic_auth.ts"].map(async (v) => {
        return [v, await fetchExample(v)];
      }),
    ),
  );
  return { codes };
};

export default BasicAuth;
