import { Article } from "../components/article.tsx";
import { Code } from "../components/code.tsx";
import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { DFC } from "../../jsx.ts";
import { fetchExample } from "../content.ts";
import { Content } from "../components/content.tsx";
import { Q } from "../components/common.tsx";

const HandleWebSocket: DFC<{ codes: { [key: string]: string } }> = ({
  codes,
}) => (
  <Content>
    <Article>
      <section id={"handle-ws"}>
        <h2>Handle WebSocket</h2>
        <p>
          Servest provides WebSocket handler for Router API.
          <Q>router.ws()</Q> is register for WebSocket route. <br />
          Handler will be called after WebSocket upgrade finished.
        </p>
        <Code href={"/example/handle_ws.ts"} code={codes["handle_ws.ts"]} />
      </section>
    </Article>
  </Content>
);

HandleWebSocket.getInitialProps = async () => {
  const codes = Object.fromEntries(
    await Promise.all(
      ["handle_ws.ts"].map(async (v) => {
        return [v, await fetchExample(v)];
      }),
    ),
  );
  return { codes };
};

export default HandleWebSocket;
