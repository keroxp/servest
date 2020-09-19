import { RouteHandler } from "../../../mod.ts";

const handle: RouteHandler = (req) => {
  // Get cookie from request
  const deno = req.cookies.get("deno");
  // Set cookie
  req.setCookie("deno", "land", {
    path: "/",
    httpOnly: true, // Protect cookies read from JavaScript (document.cookie)
    maxAge: 1000 * 60 * 60 * 30,
  } // 30min
  );
  return req.respond({ status: deno ? 200 : 400, body: deno });
};
