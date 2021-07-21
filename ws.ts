import { ServerRequest } from "./server.ts";
import { Deferred, deferred } from "./vendor/https/deno.land/std/async/mod.ts";
import * as ws from "./vendor/https/deno.land/std/ws/mod.ts";

export async function upgradeWebSocket(
  req: ServerRequest,
): Promise<ws.WebSocket | undefined> {
  if (req.ev) {
    // @ts-ignore
    const { response, websocket } = await Deno.upgradeWebSocket(req.ev.request);
    await req.ev.respondWith(response);
    return nativeWebSocketAdapter(websocket);
  } else {
    const { conn, bufReader, bufWriter, headers } = req;
    if (!ws.acceptable(req)) return;
    return ws.acceptWebSocket({ conn, bufReader, bufWriter, headers });
  }
}

function nativeWebSocketAdapter(ws: WebSocket): ws.WebSocket {
  let closed = false;
  return {
    get conn(): Deno.Conn {
      throw new Error("unsupported");
    },
    get isClosed() {
      return closed;
    },
    async *[Symbol.asyncIterator]() {
      let latch: Deferred<ws.WebSocketMessage | null> = deferred();
      ws.addEventListener(
        "message",
        (msg: MessageEvent<string | ArrayBuffer>) => {
          if (typeof msg.data === "string") {
            latch.resolve(msg.data);
          } else {
            latch.resolve(new Uint8Array(msg.data));
          }
        },
      );
      ws.addEventListener("close", () => {
        closed = true;
        latch.resolve(null);
      });
      while (!closed) {
        const msg = await latch;
        if (msg) {
          yield msg;
        } else {
          break;
        }
        latch = deferred();
      }
    },
    async send(data: ws.WebSocketMessage) {
      ws.send(data);
    },
    async ping(data?: ws.WebSocketMessage) {
      // noop
    },
    async close(code?: number, reason?: string) {
      ws.close(code, reason);
    },
    closeForce() {
      ws.close();
    },
  };
}
