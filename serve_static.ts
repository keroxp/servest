// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { HttpHandler } from "./router.ts";
import * as path from "./vendor/https/deno.land/std/fs/path.ts";
import * as media_types from "./vendor/https/deno.land/std/media_types/mod.ts";
import { resolveIndexPath } from "./router_util.ts";

export type ServeStaticOptions = {
  /**
   * content type resolvers
   * .ext -> application/some-type
   * By default, .ts/.tsx will be resolved by application/typescript
   */
  contentTypeMap?: Map<string, string>;
  contentDispositionMap?: Map<string, "inline" | "attachment">;
  /** Custom filter function for files */
  filter?: (file: string) => boolean | Promise<boolean>;
};
export function serveStatic(
  dirOrUrl: string | URL,
  opts: ServeStaticOptions = {}
): HttpHandler {
  const contentTypeMap = new Map<string, string>([
    [".ts", "application/javascript"],
    [".tsx", "application/javascript"],
    ...(opts.contentTypeMap || new Map<string, string>()).entries()
  ]);
  const contentDispositionMap = opts.contentDispositionMap || new Map([]);
  const filter = opts.filter || (() => true);
  const dir = dirOrUrl instanceof URL ? dirOrUrl.pathname : dirOrUrl;
  return async function serveStatic(req) {
    if (req.method === "GET" || req.method === "HEAD") {
      const url = new URL(req.url, "http://dummy");
      const filepath = await resolveIndexPath(dir, url.pathname);
      if (!filepath || !(await filter(filepath))) {
        return;
      }
      const stat = await Deno.stat(filepath);
      const ext = path.extname(filepath);
      const base = path.basename(filepath);
      let contentType =
        contentTypeMap.get(ext) ||
        media_types.contentType(ext) ||
        "application/octet-stream";
      const headers = new Headers({
        "content-length": stat.len + "",
        "content-type": contentType
      });
      const contentDisposition = contentDispositionMap.get(ext);
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
