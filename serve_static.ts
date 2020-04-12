// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import * as path from "./vendor/https/deno.land/std/path/mod.ts";
import { resolveIndexPath } from "./matcher.ts";
import { ServeHandler } from "./server.ts";
import { contentTypeByExt } from "./media_types.ts";

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
  opts: ServeStaticOptions = {},
): ServeHandler {
  const contentTypeMap = new Map<string, string>([
    ...(opts.contentTypeMap || new Map<string, string>()).entries(),
  ]);
  const contentDispositionMap = opts.contentDispositionMap || new Map([]);
  const filter = opts.filter || (() => true);
  return async function serveStatic(req) {
    if (req.method === "GET" || req.method === "HEAD") {
      const filepath = await resolveIndexPath(
        dir,
        decodeURIComponent(req.path),
      );
      if (!filepath || !(await filter(filepath))) {
        return;
      }
      const stat = await Deno.stat(filepath);
      const ext = path.extname(filepath);
      const base = path.basename(filepath);
      let contentType = contentTypeMap.get(ext) ||
        contentTypeByExt(ext) ||
        "application/octet-stream";
      const headers = new Headers({
        "content-length": stat.size + "",
        "content-type": contentType,
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
          headers,
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
