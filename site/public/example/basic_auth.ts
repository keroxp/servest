import { basicAuth, createApp } from "../../../mod.ts";
const app = createApp();
// Add global auth middleware
app.use(
  basicAuth({
    credentials: [{
      username: "deno",
      password: "deno is nice",
    }, {
      username: "node",
      password: "node is awesome",
    }],
  }),
);
app.get("/", async (req) => {
  await req.respond({
    status: 200,
    headers: new Headers({
      "content-type": "text/plain",
    }),
    body: "Hello, Servest!",
  });
});
app.listen({ port: 8899 });
