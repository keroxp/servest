import { createRouter } from "https://servestjs.org/@/router.ts";
const router = createRouter();
// Define route with string pattern.
// Called if request path exactly match "/"
router.get("/", async req => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/plain"
    }),
    body: "Hello, Servest!"
  });
});
// Define route with regexp pattern.
// Called if request path matches regex.
// If multiple route matches path, the longest match route will be called.
router.get(new RegExp("^/foo/(.+)"), async req => {
  const [_, id] = req.match;
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "application/json"
    }),
    body: JSON.stringify({ id })
  });
});
// Start listening on port 8899
router.listen(":8899");
