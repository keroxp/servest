import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { Content } from "../components/content.tsx";
import { Article } from "../components/article.tsx";
import { Code } from "../components/code.tsx";
import { DFC } from "../../jsx.ts";
import { fetchExampleCodes } from "../content.ts";
import { DocLink } from "../components/doc-link.tsx";

const HandleCors: DFC<{
  codes: { [key: string]: string };
}> = ({ codes }) => (
  <Content>
    <Article>
      <section id={"handle-cors"}>
        <h2>Handle CORS</h2>
        <p>
          <DocLink file="middleware/cors.ts">cors</DocLink>
          is built-in middleware for CORS (cross-origin resource sharing).
        </p>
        <Code
          href={"/example/handle_cors.ts"}
          code={codes["handle_cors.ts"]}
        />
      </section>
    </Article>
  </Content>
);
HandleCors.getInitialProps = async () => {
  const codes = await fetchExampleCodes("handle_cors.ts");
  return { codes };
};
export default HandleCors;
