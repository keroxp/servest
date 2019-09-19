import { createRouter } from "../router.ts";
import { serveStatic } from "../serve_static.ts";

const router = createRouter();
const port = Deno.env()["PORT"] || "8899";
router.use(serveStatic("./public"));
router.listen(":" + port);
console.log("servest-site: running on :" + port);
