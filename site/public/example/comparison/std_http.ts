import {
  serve,
} from "https://deno.land/std/http/mod.ts";

const server = serve({ port: 8888 });
for await (const req of server) {
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/plain",
    }),
    body: "hello deno!",
  });
}
