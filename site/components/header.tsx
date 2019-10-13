import React from "../../vendor/https/dev.jspm.io/react/index.js";

export const Header: React.FC = () => (
  <div className="header">
    <div className="inner">
      <div>
        <a href={"/"} className="brand">Servest</a>
      </div>
      <div className="spacer"/>
      <div className="headerItem">
        <a href="/get-started">Get Started</a>
      </div>
      <div className="headerItem">
        <a href="/concept">Concept</a>
      </div>
      <div className="headerItem">
        <a href="/features">Features</a>
      </div>
      <div className="headerItem">
        <a href="https://github.com/keroxp/servest" target="_blank">
          <div  className="githubLogo" />
        </a>
      </div>
    </div>
  </div>
);
