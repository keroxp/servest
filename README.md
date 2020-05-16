# servest

[![Build Status](https://github.com/keroxp/servest/workflows/CI/badge.svg)](https://github.com/keroxp/servest/actions)
![https://img.shields.io/github/tag/keroxp/servest.svg](https://img.shields.io/github/tag/keroxp/servest.svg)
[![license](https://img.shields.io/github/license/keroxp/servest.svg)](https://github.com/keroxp/servest)

🌾A progressive http server for Deno🌾

## Description

`Servest` is a http module suite for Deno. It is composed of three major APIs of HTTP protocol:

- App API: General puropose HTTP routing server.
- Server API: Low-level HTTP API for processing HTTP/1.1 requests.
- Agent API: Low-level API for managing HTTP/1.1 Keep-Alive connection to the host.

In order to experiment and be progressive, we have our own implementation of HTTP/1.1 server apart from [std/http](https://deno.land/std/http).

## Usage

To get a more detailed information, go to https://servestjs.org

```ts
// @deno-types="https://servestjs.org/@/types/react/index.d.ts"
import React from "https://dev.jspm.io/react/index.js";
// @deno-types="https://servestjs.org/@/types/react-dom/server/index.d.ts"
import ReactDOMServer from "https://dev.jspm.io/react-dom/server.js";
import { createApp } from "https://servestjs.org/@/mod.ts";

const app = createApp();
app.handle("/", async req => {
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
app.listen({port: 8888});
```

## License

MIT
