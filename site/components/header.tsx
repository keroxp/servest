import React from "../../vendor/https/dev.jspm.io/react/index.js";

export const Header: React.FC = () => (
  <div className="header">
    <div className="inner">
      <div>
        <a href={"/"} className="brand headerLink">
          Servest
        </a>
      </div>
      <div className="spacer" />
      <div className="headerItem">
        <a className="headerLink" href="/get-started">
          Get Started
        </a>
      </div>
      <div className="headerItem">
        <a className="headerLink">
          API
        </a>
        <ul className={"headerSublist"}>
          <li>
            <a href={"/router-api"}>Router API</a>
          </li>
          <li>
            <a href={"/server-api"}>Server API</a>
          </li>
          <li>
            <a href={"/agent-api"}>Agent API</a>
          </li>
        </ul>
      </div>
      <div className="headerItem">
        <a className="headerLink" href="/concept">
          Concept
        </a>
      </div>
      <div className="headerItem">
        <a className="headerLink">
          Features
        </a>
        <ul className={"headerSublist"}>
          <li>
            <a href={"/use-middleware"}>Use Middleware</a>
          </li>
          <li>
            <a href={"/use-jsx"}>Use JSX</a>
          </li>
          <li>
            <a href={"/use-serve-static"}>Serve static files</a>
          </li>
          <li>
            <a href={"/use-serve-jsx"}>Serve JSX files as a page</a>
          </li>
        </ul>
      </div>
      <div className="headerItem">
        <a href="https://github.com/keroxp/servest" target="_blank">
          <img src={"/img/github-logo-32px.png"}
               srcSet={
                 "/img/github-logo-32px.png 1x, /img/github-logo-64px.png 2x"
               }
               alt={"Github Logo"}
          />
        </a>
      </div>
    </div>
  </div>
);
