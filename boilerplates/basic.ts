import {
  createApp,
  createRouter,
  serveStatic,
} from "../mod.ts";
import { RoutingError } from "../error.ts";
const app = createApp();
app.use(serveStatic("public"));
app.get("/", async (req) => {
  req.respond({ status: 200, body: "Hello Servest🌾" });
});
app.handle(new RegExp("^/users/(\d+?)$"));

app.listen({ port: parseInt(Deno.env("PORT") ?? "8899") });
