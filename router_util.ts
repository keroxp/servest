import * as path from "./vendor/https/deno.land/std/fs/path.ts";
import { runIfMain } from "./vendor/https/deno.land/std/testing/mod.ts";

/**
 * Find the match that appeared in the nearest position to the beginning of word.
 * If positions are same, the longest one will be picked.
 * Return -1 and null if no match found.
 * */
export function findLongestAndNearestMatch(
  pathname: string,
  patterns: (string | RegExp)[]
): { index: number; match: RegExpMatchArray | null } {
  let lastMatchIndex = pathname.length;
  let lastMatchLength = 0;
  let match: RegExpMatchArray | null = null;
  let index = -1;
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    if (pattern instanceof RegExp) {
      const m = pathname.match(pattern);
      if (!m || m.index === undefined) {
        continue;
      }
      if (
        m.index < lastMatchIndex ||
        (m.index === lastMatchIndex && m[0].length > lastMatchLength)
      ) {
        index = i;
        match = m;
        lastMatchIndex = m.index;
        lastMatchLength = m[0].length;
      }
    } else if (pathname === pattern && pattern.length > lastMatchLength) {
      index = i;
      match = [pattern];
      lastMatchIndex = 0;
      lastMatchLength = pattern.length;
    }
  }
  return { index, match };
}

export async function resolveIndexPath(
  dir: string,
  pathname: string,
  ext: string = ".html"
): Promise<string | undefined> {
  let filepath = path.join(dir, pathname);
  const fileExists = async (s: string): Promise<boolean> => {
    try {
      const stat = await Deno.stat(s);
      return stat.isFile();
    } catch (e) {
      return false;
    } finally {
    }
  };
  if (await fileExists(filepath)) {
    return filepath;
  }
  if (
    filepath.endsWith("/") &&
    (await fileExists(path.resolve(filepath + "index" + ext)))
  ) {
    return filepath + "index" + ext;
  } else if (await fileExists(path.resolve(filepath + ext))) {
    return filepath + ext;
  }
}

runIfMain(import.meta);
