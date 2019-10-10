import { runIfMain, test } from "./vendor/https/deno.land/std/testing/mod.ts";
import { MultipartWriter } from "./vendor/https/deno.land/std/mime/multipart.ts";
import {
  assert,
  assertEquals,
  assertThrowsAsync
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import { parserMultipartRequest } from "./body_parser.ts";
import * as fs from "./vendor/https/deno.land/std/fs/mod.ts";
import Buffer = Deno.Buffer;
import { it } from "./test_util.ts";

it("multipart", t => {
  t.run("basic", async () => {
    const buf = new Buffer();
    const w = new MultipartWriter(buf);
    await w.writeField("deno", "land");
    const f = await Deno.open("./README.md");
    await w.writeFile("file", "README.md", f);
    await w.close();
    f.close();
    const m = await parserMultipartRequest(
      {
        headers: new Headers({
          "content-type": w.formDataContentType()
        }),
        body: buf
      },
      1000
    );
    assertEquals(m.field("hoge"), undefined);
    assertEquals(m.field("deno"), "land");
    const mfile = m.file("file")!;
    assertEquals(mfile.filename, "README.md");
    assert(mfile.tempfile !== undefined, "temp file should be created");
    await m.removeAllTempFiles();
    assertEquals(await fs.exists(mfile.tempfile!), false);
  });
  t.run("should throw if content-type is invalid", async () => {
    const body = new Buffer();
    await assertThrowsAsync(
      async () => {
        await parserMultipartRequest({
          headers: new Headers(),
          body
        });
      },
      Error,
      "is not multipart"
    );
    await assertThrowsAsync(
      async () => {
        await parserMultipartRequest({
          headers: new Headers({
            "content-type": "application/json"
          }),
          body
        });
      },
      Error,
      "is not multipart"
    );
    await assertThrowsAsync(
      async () => {
        await parserMultipartRequest({
          headers: new Headers({
            "content-type": "multipart/form-data; "
          }),
          body
        });
      },
      Error,
      "doesn't have boundary"
    );
  });
});

runIfMain(import.meta);
