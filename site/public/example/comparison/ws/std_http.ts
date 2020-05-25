import {
  serve,
} from "https://deno.land/std/http/mod.ts";
import {
  acceptWebSocket,
  acceptable,
} from "https://deno.land/std/ws/mod.ts";

const server = serve({ port: 8888 });
for await (const req of server) {
  if (
    req.method === "GET" &&
    req.url === "/ws" &&
    acceptable(req)
  ) {
    acceptWebSocket({
      headers: req.headers,
      conn: req.conn,
      bufWriter: req.w,
      bufReader: req.r,
    }).then(async (sock) => {
      for await (const msg of sock) {
        if (typeof msg === "string") {
          // handle messages...
        }
      }
    }).catch((e) => {
      req.respond({ status: 400 });
    });
  } else {
    req.respond({ status: 404 });
  }
}
