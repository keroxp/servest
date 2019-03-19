# servest

![https://travis-ci.org/keroxp/servest.svg?branch=master](https://travis-ci.org/keroxp/servest.svg?branch=master)

🌾A progressive http server / router for deno🌾

## Usage

### Serve API

`serve` API is compatible to [deno_std@v0.3.1](https://github.com/denoland/deno_std/blob/master/http/server.ts) but has different implementation.
Some progressive features for HTTP/1.1 server are implemented.

- Support Keep-Alive connection
- Support trailer headers
- Support keep-alive timeout and read timeout
- `serve` is cancellable by cancel promise
- Fully interface based type definition

```ts
import { serve } from "https://denopkg.com/keroxp/servest@v0.2.1/server.ts";
async function main() {
  for await (const req of serve(`0.0.0.0:8899`)) {
    await req.respond({
      status: 200,
      headers: new Headers({
        "Content-Type": "text/plain"
      }),
      body: new TextEncoder().encode("hello")
    });
  }
}
main();
```

### Router API

Router API is minimal routing system on top of `serve()`

```ts
import { createRouter } from "https://denopkg.com/keroxp/servest@v0.2.1/router.ts";

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

## Loadmaps

- Requester API
- Middleware API for Router
- HTTP/2

## License

MIT

## Contributor

[@keroxp](https://github.com/keroxp)
