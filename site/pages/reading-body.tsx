import { Article } from "../components/article.tsx";
import { Code } from "../components/code.tsx";
import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { DFC } from "../../jsx.ts";
import { fetchExample } from "../content.ts";
import { Content } from "../components/content.tsx";
import { Q } from "../components/common.tsx";

const ReadingBody: DFC<{ codes: { [key: string]: string } }> = ({ codes }) => (
  <Content>
    <Article>
      <section id={"reading-body"}>
        <h2>Reading Body</h2>
        <p>
          <Q>ServerRequest.body</Q> implements <Q>Deno.Reader</Q>.
          And also implemnts utility mixin methods to read body data.
        </p>
        <p>
          <ul>
            <li>
              <Q>req.text()</Q> parses UTF-8 decoded strings
            </li>
            <li>
              <Q>req.json()</Q> try to parse body string as JSON
            </li>
            <li>
              <Q>req.formData()</Q> try to parse if content-type is one of:
              <ul>
                <li>
                  <Q>multipart/form-data</Q>
                </li>
                <li>
                  <Q>application/x-www-form-urlencoded</Q>
                </li>
              </ul>
            </li>
            <li>
              <Q>req.arryBuffer()</Q> returns full raw body as{" "}
              <Q>Uint8Array</Q>
            </li>
          </ul>
        </p>
        <Code
          href={"/example/reading_body.ts"}
          code={codes["reading_body.ts"]}
        />
      </section>
    </Article>
  </Content>
);

ReadingBody.getInitialProps = async () => {
  const codes = Object.fromEntries(
    await Promise.all(
      ["reading_body.ts"].map(async (v) => {
        return [v, await fetchExample(v)];
      }),
    ),
  );
  return { codes };
};

export default ReadingBody;
