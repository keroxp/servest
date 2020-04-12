import { createApp, createRouter } from "../mod.ts";

const app = createApp();
type User = {
  id: number;
  name: string;
};
function isUser(x: any): x is User {
  return x != null && typeof x.id === "number" && typeof x.name === "string";
}

function UserRoute() {
  const router = createRouter();
  const userDB = new Map<number, User>();
  router.get("/", (req) => {
    req.respond({ status: 200, body: JSON.stringify(userDB.values()) });
  });
  const regex = new RegExp("^/uesrs/(\d+?)$");
  router.get(regex, (req, { match }) => {
    const id = parseInt(match[1]);
    const user = userDB.get(id);
    if (user) {
      req.respond({ status: 200, body: JSON.stringify(user) });
    } else {
      req.respond({ status: 404 });
    }
  });
  router.put(regex, async (req, { match }) => {
    const id = parseInt(match[1]);
    const user = await req.body?.json();
    if (isUser(user) && id === user.id) {
      userDB.set(id, { id, name: user.name });
      req.respond({ status: 201, body: JSON.stringify(user) });
    } else {
      req.respond({ status: 400 });
    }
  });
  router.delete(regex, (req, { match }) => {
    const id = parseInt(match[1]);
    if (userDB.has(id)) {
      userDB.delete(id);
      req.respond({ status: 200 });
    } else {
      req.respond({ status: 404 });
    }
  });
  return router;
}
app.route("/users", UserRoute());
app.listen({ port: parseInt(Deno.env("PORT") ?? "8899") });
