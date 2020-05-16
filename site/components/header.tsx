import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { FC } from "../../types/react/index.d.ts";
import { Links } from "./content.tsx";
import { version } from "../content.ts";

export const Header: FC = () => (
  <div className="header">
    <div className="inner">
      <div>
        <a href={"/"} className="brand headerLink">
          Servest
        </a>
      </div>
      <div className="spacer" />
      <div className="headerItem">
        <a
          className="headerLink"
          target="_blank"
          href={`https://doc.deno.land/https/servestjs.org/@${version()}/mod.ts`}
        >
          Doc
        </a>
      </div>
      <div className="headerItem">
        <a className="headerLink" href="/get-started">
          Get Started
        </a>
      </div>
      <div className="headerItem">
        <a className="headerLink">API</a>
        <ul className={"headerSublist"}>
          {Links.api.map(([href, text]) => (
            <li><a href={href}>{text}</a></li>
          ))}
        </ul>
      </div>
      <div className="headerItem">
        <a className="headerLink" href="/concept">
          Concept
        </a>
      </div>
      <div className="headerItem">
        <a className="headerLink">Features</a>
        <ul className={"headerSublist"}>
          {Links.features.map(([href, text]) => (
            <li><a href={href}>{text}</a></li>
          ))}
        </ul>
      </div>
      <div className="headerItem">
        <a href="https://github.com/keroxp/servest" target="_blank">
          <img
            src={"/img/github-logo-32px.png"}
            srcSet={"/img/github-logo-32px.png 1x, /img/github-logo-64px.png 2x"}
            alt={"Github Logo"}
          />
        </a>
      </div>
    </div>
    <div className="v1">
      🎉2020/05/13 Servest v1 has been released! 🎉
    </div>
  </div>
);
