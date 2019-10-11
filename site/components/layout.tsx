import React from "../../vendor/https/dev.jspm.io/react/index.js";

export const Layout = ({children}: {
  children?: any
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
    <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico" />
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
  {children}
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.15.10/highlight.min.js" />
  <script>hljs.initHighlightingOnLoad();</script>
  </body>
  </html>
);