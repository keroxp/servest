import { listenAndServe } from "../../../server.ts";
const listener = listenAndServe(":8899", async req => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/plain"
    }),
    body: "hello"
  });
});
