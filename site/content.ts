import { CodeState } from "./view/code.tsx";
import * as path from "./vendor/https/deno.land/std/fs/path.ts";

const decoder = new TextDecoder();
const u = new URL("./public/example", import.meta.url);
const texts = (await Promise.all([
  Deno.readFile(path.join(u.pathname, "get_started.ts")),
  Deno.readFile(path.join(u.pathname, "simple_server.ts")),
  Deno.readFile(path.join(u.pathname, "routing_server.ts")),
  Deno.readFile(path.join(u.pathname, "use_middleware.ts")),
  Deno.readFile(path.join(u.pathname, "use_jsx.tsx")),
  Deno.readFile(path.join(u.pathname, "error_handler.ts"))
])).map(v => decoder.decode(v));

const contents: CodeState[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    code: texts[0],
    href: "/example/get_started.ts"
  },
  {
    id: "simple-server",
    title: "Simple Server",
    code: texts[1],
    href: "/example/simple_server.ts"
  },
  {
    id: "routing-server",
    title: "Routing Server",
    code: texts[2],
    href: "/example/routing_server.ts"
  },
  {
    id: "use-middleware",
    title: "Using Middleware for Router",
    code: texts[3],
    href: "/example/use_middleware.ts"
  },
  {
    id: "use-jsx",
    title: "Using JSX template",
    code: texts[4],
    href: "/example/use_jsx.tsx"
  },
  {
    id: "error-handler",
    title: "Error Handler for Router",
    code: texts[5],
    href: "/example/error_handler.ts"
  }
];

export default contents;
