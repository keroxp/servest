import { createApp } from "../../../app.ts";
import { createRouter } from "../../../router.ts";

const app = createApp();
function IndexRoutes() {
  const router = createRouter();
  router.get("/", req => {
    // GET /
  });
  router.get("/about", req => {
    // GET /about
  });
  return router;
}
function UserRoutes() {
  const router = createRouter();
  router.get("/", (req) => {
    // GET /users
  });
  router.post("/", (req) => {
    // POST /users
  })
  router.get("/sign_in", (req) => {
    // POST /sign_in,
  });
  function UserPostRoutes() {
    const router = createRouter();
    router.get("/", req => {
      // GET /users/posts
    })
    router.get("/inbox", req => {
      // GET /users/posts/indbox
    });
    return router;
  } 
  // Router can be nested
  router.route("/posts", UserPostRoutes());
  return router;
}

app.route("/", IndexRoutes());
app.route("/users", UserRoutes());
app.listen(":8899");