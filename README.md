# servest

[![CircleCI](https://circleci.com/gh/keroxp/servest.svg?style=svg)](https://circleci.com/gh/keroxp/servest)
![https://img.shields.io/github/tag/keroxp/servest.svg](https://img.shields.io/github/tag/keroxp/servest.svg)
[![license](https://img.shields.io/github/license/keroxp/servest.svg)](https://github.com/keroxp/servest)
[![tag](https://img.shields.io/badge/deno__std-v0.15.0-green.svg)](https://github.com/denoland/deno_std)
[![tag](https://img.shields.io/badge/deno-v0.15.0-green.svg)](https://github.com/denoland/deno)

🌾A progressive http server / router for deno🌾

## Usage

### Serve API

Serve API is similar to [deno_std@v0.15.0](https://github.com/denoland/deno_std/blob/master/http/server.ts) but has different implementation.
Some progressive features for HTTP/1.1 server are implemented.

- Support Keep-Alive connection
- Support trailer headers
- Support keep-alive timeout and read timeout
- `serve` and `listenAndServe` is cancellable by cancel promise
- Fully interface based type definition

```ts
import { listenAndServe } from "https://denopkg.com/keroxp/servest@v0.8.0/server.ts";
listenAndServe(":8899", async req => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "Content-Type": "text/plain"
    }),
    body: new TextEncoder().encode("hello")
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
import { createRouter } from "https://denopkg.com/keroxp/servest@v0.8.0/router.ts";

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
router.listen("127.0.0.1:8898");
```

### Agent API

Agent API is basic HTTP agent. It manages persistent connection to host. Each request will be sent in serial.

`fetch` is enough for most cases. It is useful if you want to manage keep-alive connection to host.

**NOTE: Currently TLS (HTTPS) agent is not supported as Deno doesn't.**

Use `fetch` for https request.

#### GET

```ts
import { createAgent } from "https://denopkg.com/keroxp/servest@v0.8.0/agent.ts";
const agent = createAgent("http://127.0.0.1:8700");
const { status, body } = await agent.send({
  path: "/get?deno=land",
  method: "GET"
});
```

#### POST

```ts
import { createAgent } from "https://denopkg.com/keroxp/servest@v0.8.0/agent.ts";
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

- Middleware API for Router
- HTTP/2
- HTTP testing api

## License

MIT

## Contributor

[@keroxp](https://github.com/keroxp)
