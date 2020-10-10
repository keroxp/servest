import { createApp } from "../../../../../mod.ts";

const app = createApp();
app.ws("/ws", async (sock) => {
  for await (const msg of sock) {
    if (typeof msg === "string") {
      // handle messages...
    }
  }
});
