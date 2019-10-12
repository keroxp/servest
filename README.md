# servest

[![CircleCI](https://circleci.com/gh/keroxp/servest.svg?style=svg)](https://circleci.com/gh/keroxp/servest)
![https://img.shields.io/github/tag/keroxp/servest.svg](https://img.shields.io/github/tag/keroxp/servest.svg)
[![license](https://img.shields.io/github/license/keroxp/servest.svg)](https://github.com/keroxp/servest)
[![tag](https://img.shields.io/badge/deno-v0.20.0-green.svg)](https://github.com/denoland/deno)
[![tag](https://img.shields.io/badge/deno__std-v0.20.0-green.svg)](https://github.com/denoland/deno_std)

🌾A progressive http server for Deno🌾

## Usage

### Serve API

Serve API is low-level API for handling http requests. `servest` has its own serving implementation based on `Deno.listen()`. It doesn't depend on deno_std's `http` module.

- Support Keep-Alive connection
- Support trailer headers
- Support keep-alive timeout and read timeout
- `listenAndServe` is cancellable by `listener.close()`
- Fully interface based type definition

```ts
import { listenAndServe } from "https://servestjs.org/@/server.ts";
const listener = listenAndServe("127.0.0.1:8899", async req => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "Content-Type": "text/plain"
    }),
    body: "hello"
  });
});
```

### Router API

Router API is minimal routing system on top of `listenAndServe()`

```ts
import { createRouter } from "https://servestjs.org/@/router.ts";

const router = createRouter();
router.handle("/", async req => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/plain"
    }),
    body: "ok"
  });
});
router.handle(new RegExp("/foo/(?<id>.+)"), async req => {
  const { id } = req.match.groups;
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "application/json"
    }),
    body: JSON.stringify({ id })
  });
});
router.listen("127.0.0.1:8899");
```

### Middleware API for Router

Router can use common http handler

```ts
import { serveStatic } from "https://servestjs.org/@/serve_static.ts";
// Files in ./public are served automatically (GET, HEAD)
router.use(serveStatic("./public"));
```

### Global Error Handler for Router

```ts
// Called when unhandled error occurred while processing requests
router.handleError((e, req) => {
  console.error(e);
  req.respond({
    status: 500,
    body: "Internal Server Error"
  });
});
```

### Agent API

Agent API is basic HTTP/HTTPS agent. It manages persistent connection to the host. Each request will be sent in serial.

`fetch` is enough for most cases. It is useful if you want to manage keep-alive connection to the host.

#### GET

```ts
import { createAgent } from "https://servestjs.org/@/agent.ts";
const agent = createAgent("http://127.0.0.1:8700");
const { status, body } = await agent.send({
  path: "/get?deno=land",
  method: "GET"
});
```

#### POST

```ts
import { createAgent } from "https://servestjs.org/@/agent.ts";
const { status, headers, body } = await agent.send({
  path: "/post",
  method: "POST",
  headers: new Headers({
    "Content-Type": "text/plain"
  }),
  body: "deno=land"
});
```

## Loadmaps for v1

- [ ] HTTP/2
- [ ] Security Middleware
- [x] HTTP testing api
- [ ] Cookie and Session support
- [x] Body parsers (json, form, multipart)

## License

MIT

## Contributor

[@keroxp](https://github.com/keroxp)
