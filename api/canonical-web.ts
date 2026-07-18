export const AMOS_PRODUCTION_WEB_ORIGIN = "https://amos-ops.com";

export function canonicalWebLocation(requestUrl: string): string {
  const request = new URL(requestUrl);
  return new URL(
    `${request.pathname}${request.search}`,
    AMOS_PRODUCTION_WEB_ORIGIN,
  ).toString();
}
