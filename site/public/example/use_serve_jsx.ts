import { createRouter } from "https://servestjs.org/@/router.ts";
import { serveJsx } from "https://servestjs.org/@/serve_jsx.ts";
const router = createRouter();
// .jsx/.tsx files in ./pages directory will be dynamically imported
// and rendered component served as html
router.use(serveJsx("./pages"));
router.listen(":8899");
