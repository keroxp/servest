#!/usr/bin/env deno run --allow-net --allow-read --allow-env
// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import { siteApp } from "./app.ts";

const app = siteApp();
const port = Deno.env.get("PORT") ?? "8899";
app.listen({ hostname: "0.0.0.0", port: parseInt(port) });
