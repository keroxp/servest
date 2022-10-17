// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { createDataHolder } from "./data_holder.ts";
import { assertEquals } from "./vendor/https/deno.land/std/testing/asserts.ts";

Deno.test("data_holder", async (t) => {
  await t.step("basic", () => {
    const data = createDataHolder();
    assertEquals(data.get("k"), undefined);
    assertEquals(data.getString("k"), undefined);
    assertEquals(data.getNumber("k"), undefined);
    assertEquals(data.getBoolean("k"), undefined);
    data.set("string", "s");
    assertEquals(data.get("string"), "s");
    assertEquals(data.getString("string"), "s");
    data.set("number", 1);
    assertEquals(data.get("number"), 1);
    assertEquals(data.getNumber("number"), 1);
    data.set("boolean", true);
    assertEquals(data.get("boolean"), true);
    assertEquals(data.getBoolean("boolean"), true);
    data.delete("string");
    assertEquals(data.get("string"), undefined);
  });
});
