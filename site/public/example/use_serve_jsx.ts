import { createApp, serveJsx } from "../../../mod.ts";
const app = createApp();
// .jsx/.tsx files in ./pages directory will be dynamically imported
// and rendered component served as html
app.use(serveJsx("./pages", (f) => import(f)));
app.listen({ port: 8899 });
