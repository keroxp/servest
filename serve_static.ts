import { HttpHandler } from "./router.ts";
import * as path from "./vendor/https/deno.land/std/fs/path.ts";
import * as media_types from "./vendor/https/deno.land/std/media_types/mod.ts";
import { notFound } from "./responder.ts";

export async function resolveFilepath(
  dir: string,
  pathname: string
): Promise<string | undefined> {
  let filepath = path.join(dir, pathname);
  const fileExists = async (s: string): Promise<boolean> => {
    try {
      const stat = await Deno.stat(s);
      return stat.isFile();
    } catch (e) {
      return false;
    }
  };
  if (await fileExists(filepath)) {
    return filepath;
  }
  if (filepath.endsWith("/") && (await fileExists(filepath + "index.html"))) {
    return filepath + "index.html";
  } else if (await fileExists(filepath + ".html")) {
    return filepath + ".html";
  }
}

export function serveStatic(dir: string): HttpHandler {
  return async req => {
    if (req.method === "GET" || req.method === "HEAD") {
      const url = new URL(req.url, "http://127.0.0.1");
      const filepath = await resolveFilepath(dir, url.pathname);
      if (!filepath) {
        return;
      }
      const stat = await Deno.stat(filepath);
      const ext = path.extname(filepath);
      const contentType =
        media_types.contentType(ext) || "application/octet-stream";
      const headers = new Headers({
        "Content-Length": stat.len + "",
        "Content-Type": contentType
      });
      if (req.method === "HEAD") {
        return req.respond({
          status: 200,
          headers
        });
      } else {
        const file = await Deno.open(filepath, "r");
        try {
          await req.respond({ status: 200, headers, body: file });
        } finally {
          file.close();
        }
      }
    }
  };
}
