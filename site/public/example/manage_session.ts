// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { createApp, ServerRequest } from "../../../mod.ts";
const app = createApp();
type User = {
  id: string;
  name: string;
};
const sessionMap: WeakMap<ServerRequest, User> = new WeakMap();
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
  name: string,
): Promise<User | 401> {
  // do authenticate via Database
  if (userId === "deno" && password === "land") {
    return { id: "deno", name };
  }
  return 401;
}
app.use(async (req) => {
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
app.get("/", async (req, { match }) => {
  const [_, id] = match;
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "application/json",
    }),
    body: JSON.stringify({ id }),
  });
});
app.get("/login", async (req) => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/plain",
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
    `,
  });
});
app.post("/login/auth", async (req) => {
  const form = await req.body!.formData(req.headers);
  const userId = form.field("id");
  const password = form.field("password");
  const name = form.field("name");
  if (!userId || !password || !name) {
    return req.respond({ status: 400, body: "Bad Request" });
  }
  const user = await authenticate(userId, password, name);
  if (user === 401) {
    return req.respond({ status: 401, body: "Unauthorized" });
  }
  const sid = "..."; // create session id
  await setSession(sid, user);
  req.cookies.set("sid", sid);
  return req.redirect("/");
});
app.get("/logout", async (req) => {
  req.clearCookie("sid");
  return req.redirect("/login");
});
app.listen({ port: 8899 });
