import { createApp, serveStatic } from "../../../mod.ts";
const app = createApp();
// All requests will be processed and matched files in "public" directory
// are served automatically
// Otherwise, request will be passed to next handler
app.use(serveStatic("./public"));
app.listen({ port: 8899 });
