function mergeVaryHeader(current: string | null, inherited: string): string {
  const values = new Map<string, string>();
  for (const value of [current ?? "", inherited]
    .flatMap((header) => header.split(","))
    .map((value) => value.trim())
    .filter(Boolean)) {
    values.set(value.toLowerCase(), value);
  }
  return [...values.values()].join(", ");
}

/**
 * Preserve headers applied by outer HTTP middleware when an adapter returns a
 * standalone Response object instead of writing through the Hono context.
 */
export function inheritResponseHeaders(
  response: Response,
  inheritedHeaders: Headers,
): Response {
  const headers = new Headers(response.headers);
  inheritedHeaders.forEach((value, key) => {
    if (key.toLowerCase() === "vary") {
      headers.set("Vary", mergeVaryHeader(headers.get("Vary"), value));
      return;
    }
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
