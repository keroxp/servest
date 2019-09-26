# servest

[![CircleCI](https://circleci.com/gh/keroxp/servest.svg?style=svg)](https://circleci.com/gh/keroxp/servest)
![https://img.shields.io/github/tag/keroxp/servest.svg](https://img.shields.io/github/tag/keroxp/servest.svg)
[![license](https://img.shields.io/github/license/keroxp/servest.svg)](https://github.com/keroxp/servest)
[![tag](https://img.shields.io/badge/deno__std-v0.18.0-green.svg)](https://github.com/denoland/deno_std)
[![tag](https://img.shields.io/badge/deno-v0.19.0-green.svg)](https://github.com/denoland/deno)

🌾A progressive http server / router for deno🌾

## Usage

### Serve API

Serve API is similar to [deno_std](https://github.com/denoland/deno_std/blob/master/http/server.ts) but has different implementation.
Some progressive features for HTTP/1.1 server are implemented.

- Support Keep-Alive connection
- Support trailer headers
- Support keep-alive timeout and read timeout
- `serve` and `listenAndServe` is cancellable by cancel promise
- Fully interface based type definition

```ts
import { listenAndServe } from "https://denopkg.com/keroxp/servest/server.ts";
listenAndServe("127.0.0.1:8899", async req => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "Content-Type": "text/plain"
    }),
    body: "hello"
  });
});
```

**NOTE: use listenAndServe instead of serve**

Generally `listenAndServe` has higher concurrency than `serve`
because `serve` is built top of async iteration.
`yield` in async iteration degrades concurrency of promises.

Processing of requests from identical keep-alive connection should be handled in serial, but requests from different connections should be handled in concurrent.

`listenAndServe` does it as it is built top of async callback.
It is faster than `serve` about x2 in our benchmark test.

### Router API

Router API is minimal routing system on top of `listenAndServe()`

```ts
import { createRouter } from "https://denopkg.com/keroxp/servest/router.ts";

const router = createRouter();
router.handle("/", async req => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/plain"
    }),
    body: new TextEncoder().encode("ok")
  });
});
router.handle(new RegExp("/foo/(?<id>.+)"), async req => {
  const { id } = req.match.groups;
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "application/json"
    }),
    body: new TextEncoder().encode(JSON.stringify({ id }))
  });
});
router.listen("127.0.0.1:8899");
```

### Middleware API for Router

Router can use common http handler

```ts
import { serveStatic } from "https://denopkg.com/keroxp/servest/serve_static.ts";
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
    body: new TextEncoder().encode("Internal Server Error")
  });
});
```

### Agent API

Agent API is basic HTTP agent. It manages persistent connection to host. Each request will be sent in serial.

`fetch` is enough for most cases. It is useful if you want to manage keep-alive connection to host.

**NOTE: Currently TLS (HTTPS) agent is not supported as Deno doesn't.**

Use `fetch` for https request.

#### GET

```ts
import { createAgent } from "https://denopkg.com/keroxp/servest/agent.ts";
const agent = createAgent("http://127.0.0.1:8700");
const { status, body } = await agent.send({
  path: "/get?deno=land",
  method: "GET"
});
```

#### POST

```ts
import { createAgent } from "https://denopkg.com/keroxp/servest/agent.ts";
const { status, headers, body } = await agent.send({
  path: "/post",
  method: "POST",
  headers: new Headers({
    "Content-Type": "text/plain"
  }),
  body: new TextEncoder().encode("deno=land")
});
```

## Loadmaps

- HTTP/2
- HTTP testing api
- Session support
- Body parsers (json, form, multipart)

## License

MIT

## Contributor

[@keroxp](https://github.com/keroxp)
