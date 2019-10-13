import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { Content } from "../components/content.tsx";
import { Article } from "../components/article.tsx";

export default () => (
  <Content>
    <Article>
      <section id="concept">
        <h2>Concept</h2>
        <blockquote>"The harvest of HTTP server"</blockquote>
        <p>
          Servest was developed as the optional HTTP server module to Deno's{" "}
          <a href={"https://github.com/denoland/deno/tree/master/std/http"}>
            standard http module
          </a>
          .
        </p>
        <p>
          Unfortunately, there are several bugs and TBD features and undesirable
          API designs (for me) in them.
        </p>
        <p>
          I decided to make my own http module for doing everything freely in my
          concept and decisions. Some progressive and highly abstracted features
          are tend to be refused in the conservative context like a standard
          module. "Being standard" must be tough situation and many people
          request it be stable and unchanged. In that situation, some
          experimental but maybe innovative features are omitted. So I'd wanted
          to make the handy and less opinionated next generation http module in
          one day.
        </p>
      </section>
      <section id="principals">
        <h2>Principals</h2>
        <p>
          Servest is designed by three principals:
          <ul>
            <li>
              <b>Progressive</b>: It follows the RFC standard and implements
              essential features for web development.
            </li>
            <li>
              <b>Simple</b>: API is clearly designed based on HTTP/1.1 protocol.
            </li>
            <li>
              <b>Stable</b>: It respects{" "}
              <a href="https://semver.org/" target={"_blank"}>
                semver
              </a>
              's compatibility.
            </li>
            <li>
              <b>Ready</b>: It is ready for use today. (for production? ...🤔)
            </li>
          </ul>
        </p>
      </section>
    </Article>
  </Content>
);
