// Copyright 2019 Yusuke Sakurai. All rights reserved. MIT license.
import { contentTypeFilter } from "../../../middleware.ts";
import { createApp } from "../../../app.ts";
const app = createApp();
app.post("/json", contentTypeFilter("application/json"), async (req) => {
  const bodyJson = (await req.body!.json()) as { name: string; id: string };
  // ...respond
});
app.post("/text", contentTypeFilter("text/plain"), async (req) => {
  const bodyText = await req.body!.text();
  // ...respond
});
app.post(
  "/multipart",
  contentTypeFilter("multipart/form-data"),
  async (req) => {
    const bodyForm = await req.body!.formData(req.headers);
    const name = bodyForm.field("name");
    const file = bodyForm.file("file");
    try {
      // ...respond
    } finally {
      // Clean up stored temp files
      await bodyForm.removeAllTempFiles();
    }
  },
);
app.post(
  "/form-urlencoded",
  contentTypeFilter("application/x-www-form-urlencoded"),
  async (req) => {
    const bodyForm = await req.body!.formData(req.headers);
    const name = bodyForm.field("name");
    const id = bodyForm.field("id");
    // ...respond
  },
);
app.post("/raw", async (req) => {
  const buf = await req.body!.arrayBuffer();
  // ...respond
});
// Start listening on port 8899
app.listen(":8899");
