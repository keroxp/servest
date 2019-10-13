import { pathResolver } from "../util.ts";

const decoder = new TextDecoder();
const resolve = pathResolver(import.meta);
export async function fetchExample(filename: string): Promise<string> {
  const p = resolve("./public/example/" + filename);
  const b = await Deno.readFile(p);
  return decoder.decode(b);
}
