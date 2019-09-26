// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { runIfMain, test } from "./vendor/https/deno.land/std/testing/mod.ts";
import { defer, Deferred } from "./promises.ts";
import { encode } from "./vendor/https/deno.land/std/strings/encode.ts";
import { createAgent } from "./agent.ts";
import { createRouter } from "./router.ts";
import {
  assertEquals,
  assertThrows
} from "./vendor/https/deno.land/std/testing/asserts.ts";
import Reader = Deno.Reader;
import Buffer = Deno.Buffer;
import copy = Deno.copy;

async function readString(r: Reader) {
  const buf = new Buffer();
  await copy(buf, r);
  return buf.toString();
}

let _port = 8700;
function setupRouter(port: number): Deferred {
  const d = defer();
  const router = createRouter();
  router.handle("/get", async req => {
    return req.respond({
      status: 200,
      body: encode("ok")
    });
  });
  router.handle("/post", async req => {
    return req.respond({
      status: 200,
      headers: req.headers,
      body: req.body
    });
  });
  router.listen(`:${port}`, { cancel: d.promise });
  return d;
}

test(async function agent() {
  setupRouter(++_port);
  const agent = createAgent(`http://127.0.0.1:${_port}`);
  try {
    {
      const res = await agent.send({
        path: "/get",
        method: "GET"
      });
      assertEquals(res.status, 200);
      assertEquals(await readString(res.body), "ok");
    }
    {
      const res = await agent.send({
        path: "/post",
        method: "POST",
        body: encode("denoland")
      });
      assertEquals(res.status, 200);
      assertEquals(await readString(res.body), "denoland");
    }
  } catch (e) {
    console.error(e);
  } finally {
    agent.conn.close();
    // setup.resolve();
  }
});

test(async function agentTls() {
  const agent = createAgent(`https://httpbin.org`);
  try {
    {
      const res = await agent.send({
        path: "/get?deno=land",
        method: "GET"
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
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8"
        }),
        body: "deno=land"
      });
      assertEquals(res.status, 200);
      const body = await readString(res.body);
      const resp = JSON.parse(body);
      assertEquals(resp["form"]["deno"], "land");
    }
  } catch (e) {
    console.error(e);
  } finally {
    agent.conn.close();
    // setup.resolve();
  }
});

test(async function agentUnreadBody() {
  setupRouter(++_port);
  const agent = createAgent(`http://127.0.0.1:${_port}`);
  try {
    await agent.send({ path: "/get", method: "GET" });
    await agent.send({ path: "/post", method: "POST", body: encode("ko") });
    const { body } = await agent.send({
      path: "/post",
      method: "POST",
      body: encode("denoland")
    });
    assertEquals(await readString(body), "denoland");
  } catch (e) {
    console.error(e);
  } finally {
    agent.conn.close();
  }
});

test(async function agentInvalidScheme() {
  assertThrows(() => {
    createAgent("ftp://127.0.0.1");
  });
});

runIfMain(import.meta);
