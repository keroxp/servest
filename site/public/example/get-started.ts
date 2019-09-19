import { createRouter } from "https://denopkg.com/keroxp/servest/router.ts";
const router = createRouter();
// define handler for GET / request
router.handle("/", async req => {
  if (req.method === "GET") {
    await req.respond({
      status: 200,
      body: { body: new TextEncoder().encode("OK") }
    });
  }
});
// start listening on port 8899
router.listen(":8899");
