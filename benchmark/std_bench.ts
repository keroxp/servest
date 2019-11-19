import { serve } from "https://deno.land/std@v0.24.0/http/server.ts";
const body = new TextEncoder().encode("Hello World");
const it = serve(":4500");
async function main() {
  for await (const req of it) {
    await req.respond({
      status: 200,
      body
    });
  }
}
main();
