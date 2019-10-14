import { createRouter } from "https://servestjs.org/@/router.ts";
const router = createRouter();
router.handle("/", async req => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/plain"
    }),
    body: "Hello, Servest!"
  });
});
router.handle(new RegExp("/foo/(.+)"), async req => {
  const [_, id] = req.match;
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "application/json"
    }),
    body: JSON.stringify({ id })
  });
});
router.listen(":8899");
