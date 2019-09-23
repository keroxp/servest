import { HttpHandler } from "./router.ts";
import * as path from "./vendor/https/deno.land/std/fs/path.ts";
import * as media_types from "./vendor/https/deno.land/std/media_types/mod.ts";

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
  if (
    filepath.endsWith("/") &&
    (await fileExists(path.resolve(dir, filepath + "index.html")))
  ) {
    return filepath + "index.html";
  } else if (await fileExists(path.resolve(dir, filepath + ".html"))) {
    return filepath + ".html";
  }
}

export type ServeStaticOptions = {
  /**
   * content type resolvers
   * .ext -> application/some-type
   * By default, .ts/.tsx will be resolved by application/typescript
   */
  contentTypeMap: Map<string, string>;
  contentDispositionMap: Map<string, "inline" | "attachment">;
};
export function serveStatic(
  dir: string,
  opts: ServeStaticOptions = {
    contentTypeMap: new Map<string, string>([
      [".ts", "application/javascript"],
      [".tsx", "application/javascript"]
    ]),
    contentDispositionMap: new Map([])
  }
): HttpHandler {
  return async req => {
    if (req.method === "GET" || req.method === "HEAD") {
      const url = new URL(req.url, "http://127.0.0.1");
      const filepath = await resolveFilepath(dir, url.pathname);
      if (!filepath) {
        return;
      }
      const stat = await Deno.stat(filepath);
      const ext = path.extname(filepath);
      const base = path.basename(filepath);
      let contentType =
        opts.contentTypeMap.get(ext) ||
        media_types.contentType(ext) ||
        "application/octet-stream";
      const headers = new Headers({
        "content-length": stat.len + "",
        "content-type": contentType
      });
      const contentDisposition = opts.contentDispositionMap.get(ext);
      if (contentDisposition === "attachment") {
        headers.set("content-disposition", `attachment; filename="${base}"`);
      } else if (contentDisposition === "inline") {
        headers.set("content-disposition", "inline");
      }
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
