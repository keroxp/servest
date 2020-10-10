import { createApp } from "../../../../../mod.ts";

const app = createApp();
app.post("/post", async (req) => {
  const body = await req.json();
  // handling...
});
