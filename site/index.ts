import { createRouter } from "../router.ts";
import { serveStatic } from "../serve_static.ts";

const router = createRouter();
router.handle("/", serveStatic("./public"));
router.listen(":8899");
