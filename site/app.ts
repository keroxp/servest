import { serveStatic } from "../serve_static.ts";
import { Loglevel } from "../logger.ts";
import { Layout } from "./components/layout.tsx";
import { pathResolver } from "../_util.ts";
import { serveJsx } from "../serve_jsx.ts";
import { RoutingError } from "../error.ts";
import { createApp } from "../app.ts";

export function siteApp() {
  const app = createApp({ logLevel: Loglevel.INFO });
  const resolve = pathResolver(import.meta);
  app.use(serveStatic(resolve("./public")));
  app.use(serveJsx(resolve("./pages"), (f) => import(f), Layout));
  app.catch(async (e, req) => {
    if (e instanceof RoutingError) {
      await req.sendFile(resolve("./public/error.html"));
    }
  });
  return app;
}
