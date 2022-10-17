// Copyright 2019-2020 Yusuke Sakurai. All rights reserved. MIT license.
import * as path from "./vendor/https/deno.land/std/path/mod.ts";
/**
 * Find the match that appeared in the nearest position to the beginning of word.
 * If positions are same, the longest one will be picked.
 * Return -1 and null if no match found.
 */
export function findLongestAndNearestMatches(
  pathname: string,
  patterns: (string | RegExp)[],
): [number, RegExpMatchArray][] {
  let lastMatchIndex = pathname.length;
  let lastMatchLength = 0;
  let ret: [number, RegExpMatchArray][] = [];
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    if (pattern instanceof RegExp) {
      // Regex pattern always matches pathname in ignore case mode
      const match = pathname.match(new RegExp(pattern, "i"));
      if (!match || match.index == null) {
        continue;
      }
      const { index } = match;
      const [tgt] = match;
      if (
        index <= lastMatchIndex ||
        (index === lastMatchIndex && tgt.length >= lastMatchLength)
      ) {
        if (tgt.length > lastMatchLength || index < lastMatchIndex) {
          ret = [];
        }
        ret.push([i, match]);
        lastMatchIndex = index;
        lastMatchLength = tgt.length;
      }
    } else if (
      // req.url is raw requested url string that
      // may contain capitalized strings.
      // However router compares them by normalized strings
      // "/path" matches both  "/path" and "/Path".
      pathname.toLowerCase() === pattern.toLowerCase() &&
      pattern.length >= lastMatchLength
    ) {
      if (pattern.length > lastMatchLength) {
        ret = [];
      }
      const reg = new RegExp(pathname, "i");
      const match = pathname.match(reg)!;
      ret.push([i, match]);
      lastMatchIndex = 0;
      lastMatchLength = pattern.length;
    }
  }
  return ret;
}

export async function resolveIndexPath(
  dir: string,
  pathname: string,
  extensions: string[] = [".html"],
): Promise<string | undefined> {
  let filepath = path.join(dir, pathname);
  const fileExists = async (s: string): Promise<boolean> => {
    try {
      const stat = await Deno.stat(s);
      return stat.isFile;
    } catch (e) {
      return false;
    } finally {
    }
  };
  if (await fileExists(filepath)) {
    return filepath;
  }
  for (const ext of extensions) {
    if (
      filepath.endsWith("/") &&
      (await fileExists(path.resolve(filepath + "index" + ext)))
    ) {
      return filepath + "index" + ext;
    } else if (await fileExists(path.resolve(filepath + ext))) {
      return filepath + ext;
    }
  }
}
