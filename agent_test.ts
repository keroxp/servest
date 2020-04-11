// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { encode } from "./vendor/https/deno.land/std/encoding/utf8.ts";
import { createAgent } from "./agent.ts";
import { createApp } from "./app.ts";
import {
  assertEquals,
  assertThrows,
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import Reader = Deno.Reader;
import Buffer = Deno.Buffer;
import copy = Deno.copy;
import { it } from "./test_util.ts";
import { ServeListener } from "./server.ts";

async function readString(r: Reader) {
  const buf = new Buffer();
  await copy(buf, r);
  return buf.toString();
}

function setupRouter(port: number): ServeListener {
  const app = createApp();
  app.route("/get", async (req) => {
    return req.respond({
      status: 200,
      body: encode("ok"),
    });
  });
  app.route("/post", async (req) => {
    return req.respond({
      status: 200,
      headers: req.headers,
      body: req.body,
    });
  });
  return app.listen({ port });
}

it("agent", (t) => {
  let port = 8700;
  t.beforeAfterAll(() => {
    const listener = setupRouter(port);
    return () => listener.close();
  });
  t.run("basic", async () => {
    const agent = createAgent(`http://127.0.0.1:${port}`);
    try {
      {
        const res = await agent.send({
          path: "/get",
          method: "GET",
        });
        assertEquals(res.status, 200);
        assertEquals(await readString(res.body), "ok");
      }
      {
        const res = await agent.send({
          path: "/post",
          method: "POST",
          body: encode("denoland"),
        });
        assertEquals(res.status, 200);
        assertEquals(await readString(res.body), "denoland");
      }
    } finally {
      agent.conn.close();
    }
  });
  t.run("agentTls", async () => {
    const agent = createAgent(`https://httpbin.org`);
    try {
      {
        const res = await agent.send({
          path: "/get?deno=land",
          method: "GET",
        });
        assertEquals(res.status, 200);
        const resp = JSON.parse(await readString(res.body));
        assertEquals(resp["args"]["deno"], "land");
      }
      {
        const res = await agent.send({
          path: "/post",
          method: "POST",
          headers: new Headers({
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          }),
          body: "deno=land",
        });
        assertEquals(res.status, 200);
        const body = await readString(res.body);
        const resp = JSON.parse(body);
        assertEquals(resp["form"]["deno"], "land");
      }
    } finally {
      agent.conn.close();
    }
  });
  t.run("agent unread body", async () => {
    const agent = createAgent(`http://127.0.0.1:${port}`);
    try {
      await agent.send({ path: "/get", method: "GET" });
      await agent.send({ path: "/post", method: "POST", body: encode("ko") });
      const { body } = await agent.send({
        path: "/post",
        method: "POST",
        body: encode("denoland"),
      });
      assertEquals(await readString(body), "denoland");
    } finally {
      agent.conn.close();
    }
  });
  t.run("agent invalid scheme", async () => {
    assertThrows(() => {
      createAgent("ftp://127.0.0.1");
    });
  });
});
