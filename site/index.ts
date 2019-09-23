import { createRouter } from "../router.ts";
import { serveStatic } from "../serve_static.ts";
import * as path from "../vendor/https/deno.land/std/fs/path.ts";
const router = createRouter();
const port = Deno.env()["PORT"] || "8899";
router.use(serveStatic(path.resolve(import.meta.url, "./public")));
router.listen(":" + port);
console.log("servest-site: running on :" + port);
