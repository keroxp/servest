#! deno --allow-net
// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import "./server_test.ts";
import "./responder_test.ts";
import "./router_test.ts";
import "./serveio_test.ts";
import "./agent_test.ts";
import { runTests } from "https://deno.land/std@v0.7.0/testing/mod.ts";
runTests({ exitOnFail: true }).then(() => {
  Deno.exit(0);
});
