import { createRouter } from "../../../router.ts";
import { contentTypeFilter } from "../../../middlewares.ts";
const router = createRouter();
router.post("/json", contentTypeFilter("application/json"), async req => {
  const bodyJson = (await req.body!.json()) as { name: string; id: string };
  // ...respond
});
router.post("/text", contentTypeFilter("text/plain"), async req => {
  const bodyText = await req.body!.text();
  // ...respond
});
router.post(
  "/multipart",
  contentTypeFilter("multipart/form-data"),
  async req => {
    const bodyForm = await req.body!.formData(req.headers);
    const name = bodyForm.field("name");
    const file = bodyForm.file("file");
    try {
      // ...respond
    } finally {
      // Clean up stored temp files
      await bodyForm.removeAllTempFiles();
    }
  }
);
router.post(
  "/form-urlencoded",
  contentTypeFilter("application/x-www-form-urlencoded"),
  async req => {
    const bodyForm = await req.body!.formData(req.headers);
    const name = bodyForm.field("name");
    const id = bodyForm.field("id");
    // ...respond
  }
);
router.post("/raw", async req => {
  const buf = await req.body!.arrayBuffer();
  // ...respond
});
// Start listening on port 8899
router.listen(":8899");
