// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { createAgent } from "../../../mod.ts";

async function main() {
  const agent = createAgent("https://servestjs.org");
  const res1 = await agent.send({ method: "GET", path: "/@/server.ts" });
  const res2 = await agent.send({ method: "GET", path: "/@/router.ts" });
  console.log(res1);
  console.log(res2);
}

main();
