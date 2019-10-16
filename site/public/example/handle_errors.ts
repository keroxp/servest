import { createRouter } from "../../../router.ts";
import { RoutingError } from "../../../error.ts";

const router = createRouter();
router.handle("/", async req => {
  throw new Error("error");
});
// Define global error handler for router
router.handleError(async (e, req) => {
  // All uncaught errors and unhandled promise rejections will be here.
  // Do your custom request finalization.
  if (e instanceof RoutingError && e.status === 404) {
    // RoutingError is thrown by router.
    // Typically no middleware responded to request.
    // Custom error page or response can be served here.
    const errorPage = await Deno.open("./public/error.html");
    try {
      await req.respond({
        status: 404,
        headers: new Headers({
          "content-type": "text/html"
        }),
        body: errorPage
      });
    } finally {
      errorPage.close();
    }
  } else {
    await req.respond({
      status: 500,
      body: "Internal Server Error"
    });
  }
});
router.listen(":8899");
