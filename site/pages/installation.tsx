import { Article } from "../components/article.tsx";
import { Code } from "../components/code.tsx";
import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { DFC } from "../../jsx.ts";
import { fetchExample, getServerstVersion } from "../content.ts";
import { Content } from "../components/content.tsx";

const Installation: DFC<{
  codes: { [key: string]: string };
  latestVersion: string;
}> = ({ codes, latestVersion }) => (
  <Content>
    <Article>
      <section id={"installation"}>
        <h2>Installation</h2>
        <h3>With URL</h3>
        <p>
          Servest is hosted by <a href="/">https://servestjs.org</a>
          based on Github's source codes.
          <ul>
            <li>
              <b>Latest</b>:{" "}
              <a href={"/@/server.ts"}>https://servestjs.org/@/server.ts</a>
            </li>
            <li>
              <b>Versioned</b>:{" "}
              <a href={`/@${latestVersion}/server.ts`}>
                https://servestjs.org/@{latestVersion}/server.ts
              </a>
            </li>
          </ul>
        </p>
        <h3>With dink</h3>
        <p>
          If you search for some module manager, try to use{" "}
          <a href={"https://github.com/keroxp/dink"} target={"_blank"}>
            dink
          </a>
          . Firstly create <code className="q">modules.json</code>
          and just run{" "}
          <code className="q">dink</code>.
        </p>
        <Code href={"/example/modules.json"} code={codes["modules.json"]} />
      </section>
    </Article>
  </Content>
);

Installation.getInitialProps = async () => {
  const codes = Object.fromEntries(
    await Promise.all(
      ["modules.json"].map(async (v) => {
        return [v, await fetchExample(v)];
      }),
    ),
  );
  const latestVersion = await getServerstVersion();
  return { codes, latestVersion };
};

export default Installation;
