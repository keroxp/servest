#!/usr/bin/env deno run --allow-net --allow-read --allow-env
import { siteApp } from "./app.ts";
import { deployer } from "../deploy.ts";

const app = siteApp();
addEventListener("fetch", deployer(app));
