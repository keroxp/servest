import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { Content } from "../components/content.tsx";
import { Article } from "../components/article.tsx";

export default () => (
  <Content>
    <Article>
      <section id="concept">
        <h2>Concept</h2>
        <blockquote>"For a rich harvest of HTTP server"</blockquote>
        <p>
          Servest was developed as the optional HTTP server module to Deno's
          {" "}
          <a href={"https://github.com/denoland/deno_std/tree/main/http"}>
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
          module. <b>"Being standard"</b>
          must be tough situation and many people request it be stable and
          unchanged. In that situation, some experimental but maybe innovative
          features are omitted.
        </p>
        <p>
          So I'd started making the handy and less opinionated next generation
          http module at one day.
        </p>
        <p style={{ textAlign: "center" }}>
          October 2019, By{" "}
          <a href={"https://github.com/keroxp"}>
            @keroxp
          </a>, author of Servest
        </p>
      </section>
    </Article>
  </Content>
);
