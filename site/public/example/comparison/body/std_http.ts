import { serve } from "https://deno.land/std/http/mod.ts";
import { Buffer } from "https://deno.land/std/io/buffer.ts";

const server = serve({ port: 8888 });
for await (const req of server) {
  if (
    req.method === "POST" &&
    req.url === "/post"
  ) {
    const buf = new Buffer();
    await Deno.copy(req.body, buf);
    const decoder = new TextDecoder();
    const str = decoder.decode(buf.bytes());
    const json = JSON.parse(str);
    // handling...
  } else {
    req.respond({ status: 404 });
  }
}
