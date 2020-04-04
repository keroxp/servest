const kBasicContentTypes: [string, string][] = [
  [".html", "text/html"],
  [".md", "text/markdown"],
  [".txt", "text/plain"],
  [".css", "text/css"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".gif", "image/gif"],
  [".pdf", "application/pdf"],
  [".zip", "application/zip"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".js", "application/javascript"],
  [".mjs", "application/javascript"],
  [".jsx", "application/javascript"],
  [".ts", "application/javascript"],
  [".tsx", "application/javascript"],
  [".json", "application/json"],
];

const typeByExt: Map<string, string> = kBasicContentTypes.reduce(
  (map, [e, t]) => map.set(e, t),
  new Map(),
);
const extByType: Map<string, string> = kBasicContentTypes.reduce(
  (map, [e, t]) => map.set(t, e),
  new Map(),
);

export function contentTypeByExt(extWithDot: string): string | undefined {
  return typeByExt.get(extWithDot);
}

export function extByContentType(contentType: string): string | undefined {
  return extByType.get(contentType);
}
