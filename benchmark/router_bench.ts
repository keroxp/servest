// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
// Copyright 2018-2019 the Deno authors. All rights reserved. MIT license.

import { createRouter } from "../router.ts";

const addr = Deno.args[1] || "127.0.0.1:4500";
const body = new TextEncoder().encode("Hello World");
const router = createRouter();
router.handle("/", req =>
  req.respond({
    status: 200,
    body
  }));
router.listen(addr);
