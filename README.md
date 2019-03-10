# servest

![https://travis-ci.org/keroxp/servest.svg?branch=master](https://travis-ci.org/keroxp/servest.svg?branch=master)

🌾minimal http server / router for deno🌾

## Usage

```ts
import { createRouter } from "https://denopkg.com/keroxp/servest@v0.1.0/router.ts";

const router = createRouter();
router.handle("/", async (req, { respond }) => {
  await respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/plain"
    }),
    body: new StringReader("ok")
  });
});
router.handle(new RegExp("/foo/(?<id>.+)"), async (req, { respond }) => {
  const { id } = req.match.groups;
  await respond({
    status: 200,
    headers: new Headers({
      "content-type": "application/json"
    }),
    body: new StringReader(JSON.stringify({ id }))
  });
});
router.listen("127.0.0.1:8898");
```

## License

MIT

## Contributor

[@keroxp](https://github.com/keroxp)
