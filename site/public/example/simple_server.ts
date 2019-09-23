import { listenAndServe } from "https://denopkg.com/keroxp/servest/server.ts";
listenAndServe(":8899", async req => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "Content-Type": "text/plain"
    }),
    body: "hello"
  });
});