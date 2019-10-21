import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { Content } from "../components/content.tsx";
import { Article } from "../components/article.tsx";
import { DFC } from "../../jsx.ts";
import { fetchExample } from "../content.ts";

const Features: DFC<{ codes: { [key: string]: string } }> = ({ codes }) => (
  <Content>
    <Article>
      <h2>Features</h2>
      <p />
    </Article>
  </Content>
);
export default Features;
