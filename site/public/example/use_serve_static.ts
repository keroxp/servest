import { createRouter } from "../../../router.ts";
import { serveStatic } from "../../../serve_static.ts";
const router = createRouter();
// All requests will be processed and matched files in "public" directory
// are served automatically
// Otherwise, request will be passed to next handler
router.use(serveStatic("./public"));
router.listen(":8899");
