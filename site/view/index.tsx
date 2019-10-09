import React from "../vendor/https/dev.jspm.io/react/index.js";
import {Code, CodeState} from "./code.tsx";

export const Index = ({codes}: {
  codes: CodeState[]
}) => (
  <html lang="en">
  <head>
    <meta charSet="UTF-8"/>
    <title>Servest: A progressive http server for Deno</title>
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    />
    <link rel="icon" href="/favicon.ico" />
    <meta name="description"
          content="Servest is simple, stable, and progressive http module for Deno" />
    <meta name="keywords" content="Deno,TypeScript,JavaScript,Framework,HTTP,Server,Servest" />
    <link href="./reset.css" rel="stylesheet" />
    <link href="./index.css" rel="stylesheet"/>
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.15.10/styles/solarized-dark.min.css"
    />
  </head>
  <body>
  <div className="root">
    <div className="content">
      <div className="sidebar">
        <div className="heading">
          <h1>Servest</h1>
          <p>A progressive http server for Deno</p>
        </div>
        <hr />
        <div className="sidebarSection">Examples</div>
        {codes.map(({id,title}) => (
          <div className="sidebarLink">
            <a href={"#"+id}>{title}</a>
          </div>
          ))}
        <hr />
        <div className="sidebarLink">
          <a href="https://github.com/keroxp/servest" target="_blank">
            Github
          </a>
        </div>
      </div>
      <div className="article">
        {codes.map(v => (
          <Code {...v} />
        ))}
      </div>
    </div>
    <div className="footer">
      (c) 2019 Yusuke Sakurai, MIT License, Powered by <a href="/">Servest</a>
    </div>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.15.10/highlight.min.js"></script>
  <script>
    hljs.initHighlightingOnLoad();
  </script>
  </body>
  </html>
);