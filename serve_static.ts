// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import * as path from "./vendor/https/deno.land/std/path/mod.ts";
import { resolveIndexPath } from "./_matcher.ts";
import { ServeHandler } from "./server.ts";
import { contentTypeByExt } from "./media_types.ts";
import { toIMF } from "./vendor/https/deno.land/std/datetime/mod.ts";

export interface ServeStaticOptions {
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
  /**
   * Delactives for Cache-Control header
   * No value will be sent by default.
   *  */
  cacheControl?: CacheControlOptions;
  /** Value for Expires header */
  expires?: Date;
}

export interface CacheControlOptions {
  // public: default none
  public?: boolean;
  // private: default none
  private?: boolean;
  // max-age=<sec>: default: 0
  maxAge?: number;
  // s-maxage: default none
  sMaxAge?: number;
  // no-cache: default none
  noCache?: boolean;
  // no-store: default none
  noStore?: boolean;
  // no-transform: default none
  noTransform?: boolean;
  // must-revalidate: default none
  mustRevalidate?: boolean;
  // proxy-revalidate: default none
  proxyRevalidate?: boolean;
}

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
      if (opts.cacheControl) {
        const val = buildCacheControlHeader(opts.cacheControl);
        if (val) {
          headers.set("cache-control", val);
        }
      }
      if (opts.expires) {
        headers.set("expires", toIMF(opts.expires));
      }
      if (req.method === "HEAD") {
        return req.respond({
          status: 200,
          headers,
        });
      } else {
        const file = await Deno.open(filepath, { read: true });
        try {
          await req.respond({ status: 200, headers, body: file });
        } finally {
          file.close();
        }
      }
    }
  };
}

export function buildCacheControlHeader(opts: CacheControlOptions): string {
  let ret: string[] = [];
  if (opts.public) {
    ret.push("public");
  }
  if (opts.private) {
    ret.push("private");
  }
  if (opts.noCache) {
    ret.push("no-cache");
  }
  if (opts.noStore) {
    ret.push("no-store");
  }
  if (opts.maxAge != null) {
    ret.push("max-age=" + opts.maxAge);
  }
  if (opts.sMaxAge != null) {
    ret.push("s-maxage=" + opts.sMaxAge);
  }
  if (opts.mustRevalidate) {
    ret.push("must-revalidate");
  }
  if (opts.proxyRevalidate) {
    ret.push("proxy-revalidate");
  }
  if (opts.noTransform) {
    ret.push("no-transform");
  }
  return ret.join(", ");
}
