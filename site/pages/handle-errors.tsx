import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { Content } from "../components/content.tsx";
import { Article } from "../components/article.tsx";
import { Code } from "../components/code.tsx";
import { DFC } from "../../serve_jsx.ts";
import { fetchExample, fetchExampleCodes } from "../content.ts";

const HandleErrors: DFC<{
  codes: { [key: string]: string };
}> = ({ codes }) => (
  <Content>
    <Article>
      <section id={"get-started"}>
        <h2>Handle Errors</h2>
        <p>
          All uncaught error while processing HTTP requests are captured
          internally and passed into final error handler.
        </p>
        <p>There are exactly two error handlers for one Router.</p>
        <p>
          One is Servest's build-in final error handler. It handles all uncaught
          errors from middleware 500 (Internal Server error) and finalizes
          unhandled requests with 404 (Not Found).
        </p>
        <p>
          Another is custom error handler by user. Below is an example to define
          global error handler for router.
        </p>
        <p>
          There can be only one global error handler for one router.
          If custom error handler is not defined by user,
          errors are handled by built-in final error handler as default.
          If defined, errors are passed to it and if not handled by it,
          errors are passed to final error handler.
        </p>
        <Code
          href={"/example/handle_errors.ts"}
          code={codes["handle_errors.ts"]}
        />
      </section>
    </Article>
  </Content>
);
HandleErrors.getInitialProps = async () => {
  const codes = await fetchExampleCodes("handle_errors.ts");
  return { codes };
};
export default HandleErrors;
