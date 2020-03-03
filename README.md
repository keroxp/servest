# servest

[![Build Status](https://github.com/keroxp/servest/workflows/CI/badge.svg)](https://github.com/keroxp/servest/actions)
![https://img.shields.io/github/tag/keroxp/servest.svg](https://img.shields.io/github/tag/keroxp/servest.svg)
[![license](https://img.shields.io/github/license/keroxp/servest.svg)](https://github.com/keroxp/servest)

🌾A progressive http server for Deno🌾

## Description

`Servest` is a http module suite for Deno. It is composed of three major APIs of HTTP protocol:

- Router API: General puropose HTTP routing server.
- Server API: Low-level HTTP API for processing HTTP/1.1 requests.
- Agent API: Low-level API for managing HTTP/1.1 Keep-Alive connection to the host.

We doesn't depend on Deno's [standard http module](https://deno.land/std/http) and has our own implementation of HTTP/1.1 server. It is because of beeing progressive and experimental.

## Usage

To get more detialed information, go to https://servestjs.org

```ts
// @deno-types="https://servestjs.org/@/types/react/index.d.ts"
import React from "https://dev.jspm.io/react/index.js";
// @deno-types="https://servestjs.org/@/types/react-dom/server/index.d.ts"
import ReactDOMServer from "https://dev.jspm.io/react-dom/server.js";
import { createRouter } from "https://servestjs.org/@/router.ts";

const router = createRouter();
router.handle("/", async req => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/html; charset=UTF-8"
    }),
    body: ReactDOMServer.renderToString(
      <html>
        <head>
          <meta charSet="utf-8" />
          <title>servest</title>
        </head>
        <body>Hello Servest!</body>
      </html>
    )
  });
});
router.listen(":8899");
```

## Roadmap to v1

[See this](https://github.com/keroxp/servest/issues/83)

## License

MIT

## Contributor

[@keroxp](https://github.com/keroxp)
