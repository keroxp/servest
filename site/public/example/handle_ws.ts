import { createRouter } from "../../../router.ts";
import { WebSocket } from "https://deno.land/std/ws/mod.ts";

function handleHandshake(sock: WebSocket) {
  async function handleMessage(sock: WebSocket) {
    for await (const msg of sock.receive()) {
      if (typeof msg === "string") {
        sock.send(msg);
      }
    }
  }
  handleMessage(sock);
}
const router = createRouter();
router.ws("/ws", handleHandshake);
router.listen(":8899");