// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { ServerRequest } from "./server.ts";
import { HttpHandler } from "./router.ts";
import { encode } from "https://deno.land/std@v0.3.1/strings/strings.ts";
import * as path from "https://deno.land/std@v0.3.1/fs/path.ts";
import * as mediaTypes from "https://deno.land/std@v0.3.1/media_types/mod.ts";
import open = Deno.open;
import stat = Deno.stat;

export function basicAuth<T extends ServerRequest>(opts: {
  username: string;
  password: string;
}): HttpHandler {
  return async (req, { respond }) => {
    const { headers } = req;
    if (!headers.has("authorization")) {
      await respond({
        status: 403,
        body: encode("Forbidden")
      });
      return;
    }
    const v = headers.get("authorization");
    const m = v.match(/^Basic (.+?)/);
    if (m && m.length > 1) {
      const s = m[1];
      const up = atob(s);
      const [username, password] = up.split(":");
      if (username !== opts.username || password !== opts.username) {
        const res = encode("Not Authorized");
        await respond({
          status: 401,
          headers: new Headers({
            "Content-Type": "text/plain",
            "Content-Length": `${res.byteLength}`
          }),
          body: res
        });
        return;
      }
      return req;
    }
  };
}

export function serveStatic(opts: {
  root: string;
  contentTypes: { [extWithDot: string]: string };
}): HttpHandler {
  return async (req, { respond }) => {
    const url = new URL(req.url);
    const filepath = path.resolve(opts.root, url.pathname);
    try {
      const s = await stat(filepath);
      if (s.isFile()) {
        const ext = path.extname(filepath);
        const contentType =
          mediaTypes.contentType(ext) || "application/octet-stream";
        let f: Deno.File;
        try {
          f = await open(filepath, "r");
          await respond({
            status: 200,
            headers: new Headers({
              "Content-Type": contentType,
              "Content-Length": `${s.len}`
            }),
            body: f
          });
        } finally {
          if (f) f.close();
        }
      }
    } catch (e) {
      // ignored
    }
  };
}
