import { createRouter } from "../../../router.ts";
const router = createRouter();
router.handle("/", async req => {
  throw new Error("error");
});
router.handleError(async (e, req) => {
  // All uncaught errors and unhandled promise rejections will be here.
  // Do your custom request finalization.
  await req.respond({
    status: 500,
    body: "Internal Server Error"
  });
});
router.listen(":8899");
