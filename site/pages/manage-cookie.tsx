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
      <section id={"manage-cookie"}>
        <h2>Manage Cookie</h2>
        <p>
          Cookies sent from client are stored in <Q>req.cookies</Q>.
        </p>
        <p>
          To set cookie to client, use <Q>req.setCookie()</Q> with options.
        </p>
        <p></p>
        <Code
          href={"/example/manage_cookie.ts"}
          code={codes["manage_cookie.ts"]}
        />
      </section>
    </Article>
  </Content>
);

ServerApi.getInitialProps = async () => {
  const codes = Object.fromEntries(
    await Promise.all(
      ["manage_cookie.ts"].map(async (v) => {
        return [v, await fetchExample(v)];
      }),
    ),
  );
  return { codes };
};

export default ServerApi;
