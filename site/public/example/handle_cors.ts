import { createApp, createRouter, serveStatic } from "../../../mod.ts";
import { cors } from "../../../middleware/cors.ts";
const app = createApp();
app.use(
  // allow access to static resource only from (*.)servestjs.org
  cors({
    origin: /servestjs\.org$/,
    methods: ["GET", "HEAD"],
  }),
  serveStatic("public"),
);
const api = createRouter();
// allow all access to /api routes
api.use(cors({
  origin: "*",
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["x-my-api-token"],
  maxAge: 300,
}));
app.route("/api", api);
app.listen({ port: 8899 });
