// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { HttpHandler } from "./router.ts";
import * as path from "./vendor/https/deno.land/std/fs/path.ts";
import * as media_types from "./vendor/https/deno.land/std/media_types/mod.ts";
import { resolveIndexPath } from "./router_util.ts";

export type ServeStaticOptions = {
  /**
   * Custom Content-Type mapper.
   * .ext -> application/some-type
   * By default, .ts/.tsx will be resolved by application/typescript.
   */
  contentTypeMap?: Map<string, string>;
  /**
   * Custom Content-Disposition mapper.
   * .ext -> "inline" | "attachment"
   * By default, Content-Disposition header won't be set for any files.
   */
  contentDispositionMap?: Map<string, "inline" | "attachment">;
  /** Custom filter function for files */
  filter?: (file: string) => boolean | Promise<boolean>;
};

/**
 * Serve static files in specified directory.
 * */
export function serveStatic(
  dir: string,
  opts: ServeStaticOptions = {}
): HttpHandler {
  const contentTypeMap = new Map<string, string>([
    [".ts", "application/javascript"],
    [".tsx", "application/javascript"],
    ...(opts.contentTypeMap || new Map<string, string>()).entries()
  ]);
  const contentDispositionMap = opts.contentDispositionMap || new Map([]);
  const filter = opts.filter || (() => true);
  return async function serveStatic(req) {
    if (req.method === "GET" || req.method === "HEAD") {
      const { pathname } = new URL(req.url, "http://dummy");
      const filepath = await resolveIndexPath(
        dir,
        decodeURIComponent(pathname)
      );
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
