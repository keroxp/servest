import { siteApp } from "./app.ts";
import { deployer } from "../deploy.ts";

const app = siteApp();
addEventListener("fetch", deployer(app));
