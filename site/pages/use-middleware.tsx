import { Article } from "../components/article.tsx";
import { Code } from "../components/code.tsx";
import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { DFC } from "../../jsx.ts";
import { fetchExample } from "../content.ts";
import { Content } from "../components/content.tsx";

const UseMiddleware: DFC<{ codes: { [key: string]: string } }> = ({
  codes
}) =>
  (
    <Content>
      <Article>
        <section id={"use-middleware"}>
          <h2>Use middleware for Router</h2>
          <p>
            <code className={"q"}>HttpRouter.use()</code>
            adds global http handlers (middleware) to the router.
          </p>
          <p>
            Middleware is called on every request and behaves pre-processor for
                                              requests. Here is an example of simple authentication middleware for
                                              web API.
          </p>
          <Code
            href={"/example/use_middleware.ts"}
            code={codes["use_middleware.ts"]}
          />
        </section>
      </Article>
    </Content>
  );

UseMiddleware.getInitialProps = async () => {
  const codes = Object.fromEntries(
    await Promise.all(
      ["use_middleware.ts"].map(async v => {
        return [v, await fetchExample(v)];
      })
    )
  );
  return { codes };
};

export default UseMiddleware;
