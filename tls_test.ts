import {
  BufReader,
  BufWriter
} from "https://deno.land/std@v0.20.0/io/bufio.ts";
import { runIfMain, test } from "https://deno.land/std@v0.20.0/testing/mod.ts";
import { encode } from "https://deno.land/std@v0.20.0/strings/encode.ts";
import { readResponse } from "./serveio.ts";

test("tls", async () => {
  const conn = await Deno.dialTLS({ hostname: "google.co.jp", port: 443 });
  const bufw = new BufWriter(conn);
  const bufr = new BufReader(conn);
  let req = "";
  req += "GET / HTTP/1.1\r\n";
  req += "Host: google.co.jp\r\n";
  req += "\r\n";
  await bufw.write(encode(req));
  await bufw.flush();
  const res = await readResponse(bufr);

});

runIfMain(import.meta);
