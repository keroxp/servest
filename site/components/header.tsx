import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { FC } from "../../types/react/index.d.ts";
import { Version } from "../../_version.ts";

export const Header: FC = () => (
  <div className="header">
    <div className="inner">
      <div className="brandWrap">
        <div></div>
        <a href={"/"} className="brand headerLink">
          Servest
        </a>
        <a href="#" className="navButton mobileOnly" role="button">
          <img src="/img/nav-icon.svg" />
        </a>
      </div>
      <div className="headerItemList">
        <div className="headerItem">
          <a className="headerLink" href="/get-started">
            Get Started
          </a>
        </div>
        <div className="headerItem">
          <a className="headerLink" href="/app-api">
            API
          </a>
        </div>
        <div className="headerItem">
          <a
            className="headerLink"
            target="_blank"
            href={`https://doc.deno.land/https/servestjs.org/@${Version}/mod.ts`}
          >
            Doc
          </a>
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
    </div>
  </div>
);
