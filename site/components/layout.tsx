import React from "../../vendor/https/dev.jspm.io/react/index.js";
import { Header } from "./header.tsx";
import { Footer } from "./footer.tsx";
import { FC } from "../../types/react/index.d.ts";

export const Layout: FC = ({ children }) => (
  <html lang="en">
    <head>
      <meta charSet="UTF-8" />
      <title>Servest: A progressive http server for Deno</title>
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
      />
      <link rel="icon" href="/favicon.ico" />
      <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico" />
      <meta
        name="description"
        content="Servest is simple, stable, and progressive http module for Deno"
      />
      <meta
        name="keywords"
        content="Deno,TypeScript,JavaScript,Framework,HTTP,Server,Servest"
      />
      <link
        href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.17.1/themes/prism-tomorrow.min.css"
        rel="stylesheet"
      />
      <link href="./reset.css" rel="stylesheet" />
      <link href="./index.css" rel="stylesheet" />
    </head>
    <body>
      <div id="root">
        <Header />
        <div style={{ padding: "10px 5px", textAlign: "center" }}>
          NOTICE: 2021/04/09 servestjs.org no longer hosts typescript files. Use
          {" "}
          <a
            href="https://deno.land/x/servest"
            target="_blak
          nk"
          >
            https://deno.land/x/servest
          </a>
        </div>
        {children}
        <Footer />
      </div>

      <script
        src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.17.1/prism.min.js"
      />
      <script
        src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.17.1/plugins/autoloader/prism-autoloader.min.js"
        integrity="sha256-ht8ay6ZTPZfuixYB99I5oRpCLsCq7Do2LjEYLwbe+X8="
        crossOrigin="anonymous"
      />
      {/*<script>hljs.initHighlightingOnLoad();</script>*/}
      <script src="/js/index.js"></script>
    </body>
  </html>
);
