import { createRouter, RoutedServerRequest } from "../../../router.ts";
const router = createRouter();
type User = {
  id: string;
  name: string;
};
const sessionMap: WeakMap<RoutedServerRequest, User> = new WeakMap();
const sessionDB = new Map<string, User>();
async function setSession(sid: string, user: User) {
  // save session to Database
  sessionDB.set(sid, user);
}
async function getSession(sid: string): Promise<User | undefined> {
  // get session from Database
  return sessionDB.get(sid);
}
async function authenticate(
  userId: string,
  password: string,
  name: string
): Promise<User | 401> {
  // do authenticate via Database
  if (userId === "deno" && password === "land") {
    return { id: "deno", name };
  }
  return 401;
}
router.use(async req => {
  const sid = req.cookies.get("sid");
  if (!sid) {
    return req.redirect("/login");
  }
  const session = await getSession(sid);
  if (!session) {
    return req.redirect("/login");
  }
  // save session to store
  sessionMap.set(req, session);
});
router.get("/", async req => {
  const [_, id] = req.match;
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "application/json"
    }),
    body: JSON.stringify({ id })
  });
});
router.get("/login", async req => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/plain"
    }),
    body: `
<html lang="en">
<header>
  <title>Login</title>
</header>
<body>
  <form action="/login/auth" method="POST">
    <div>
    <label for="id-input">Id</label>
    <input id="id-input" type="text" name="id" />   
    </div>
    <div>
      <label for="password-input">Password</label>
      <input id="password-input" type="password" name="password" />
    </div>
    <div>
      <label for="name-input">Name</label>
      <input id="note-input" type="text" name="name" />
    </div>
    <input type="submit" value="login"/>
  </form>
</body>
</html>
    `
  });
});
router.post("/login/auth", async req => {
  const form = await req.body!.formData(req.headers);
  const userId = form.field("id");
  const password = form.field("password");
  const name = form.field("name");
  const user = await authenticate(userId, password, name);
  if (user === 401) {
    return req.respond({ status: 401, body: "Unauthorized" });
  }
  const sid = "..."; // create session id
  await setSession(sid, user);
  req.cookies.set("sid", sid);
  return req.redirect("/");
});
router.get("/logout", async req => {
  req.clearCookie("sid");
  return req.redirect("/login");
});
router.listen(":8899");
