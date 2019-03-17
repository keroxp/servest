import { runIfMain, test } from "https://deno.land/std@v0.3.1/testing/mod.ts";
import { json, text } from "./body_parsers.ts";
import { IncomingHttpRequest } from "./server.ts";
import Buffer = Deno.Buffer;
import { encode } from "https://deno.land/std@v0.3.1/strings/strings.ts";
import {
  assertEquals,
  assertThrowsAsync
} from "https://deno.land/std@v0.3.1/testing/asserts.ts";

function createRequest(
  contentType: string,
  body: Uint8Array
): IncomingHttpRequest {
  return {
    url: "/",
    method: "GET",
    proto: "HTTP/1.1",
    headers: new Headers({
      "content-type": contentType,
      "content-length": `${body.byteLength}`
    }),
    body: new Buffer(body),
    conn: null,
    bufWriter: null,
    bufReader: null,
    trailers: null,
    finalize: null
  };
}

test(async function bodyParsersJson() {
  const exp = { hoge: "fuga", arr: [0, 1, 2], obj: { foo: "foo" } };
  const act = await json()(
    createRequest("application/json", encode(JSON.stringify(exp)))
  );
  assertEquals(act, exp);
  await assertThrowsAsync(async () => {
    await json()(createRequest("text/html", encode("<html></html>")));
  });
});

test(async function bodyParsersText() {
  const act = await text()(
    createRequest("text/plain; charset=utf-8", encode("way"))
  );
  assertEquals(act, "way");
});

runIfMain(import.meta);
