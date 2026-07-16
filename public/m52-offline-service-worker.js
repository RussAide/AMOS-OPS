const M52_CACHE_VERSION = "amos-ops-m52-shell-v2";
const M52_MANAGED_ROUTE = "/operations-hub/mobile-offline";
const M52_OFFLINE_SHELL_URLS = Object.freeze([
  "/index.html",
  "/m52-manifest.webmanifest",
  "/assets/AMOS-OPS_Logo_Small.png",
  "/assets/AMOS-OPS_Icon_Transparent.png",
  "/assets/AMOS-OPS_Logo_Horizontal_Light.png",
]);
const M52_CONTROLLED_SHELL_PATHS = new Set(M52_OFFLINE_SHELL_URLS);
const M52_PROTECTED_PATH_PREFIXES = Object.freeze([
  "/uploads/",
  "/documents/",
  "/downloads/",
  "/exports/",
]);

function m52BuildAssetPaths(indexHtml) {
  return [
    ...new Set(
      [...indexHtml.matchAll(/(?:src|href)=["'](\/assets\/[^"'?]+\.(?:js|css|woff2?))["']/g)].map(
        (match) => match[1],
      ),
    ),
  ];
}

async function m52InstallControlledShell() {
  const cache = await caches.open(M52_CACHE_VERSION);
  const indexResponse = await fetch("/index.html", {
    cache: "no-cache",
    credentials: "same-origin",
  });
  if (!indexResponse.ok) throw new Error("M52_OFFLINE_INDEX_UNAVAILABLE");
  const indexHtml = await indexResponse.clone().text();
  const buildAssets = m52BuildAssetPaths(indexHtml);
  if (buildAssets.length === 0)
    throw new Error("M52_OFFLINE_BUILD_ASSETS_UNRESOLVED");
  await cache.put("/index.html", indexResponse);
  await cache.addAll([
    ...M52_OFFLINE_SHELL_URLS.filter((path) => path !== "/index.html"),
    ...buildAssets,
  ]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(m52InstallControlledShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("amos-ops-m52-shell-") && key !== M52_CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "M52_SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (
    [
      "M52_PURGE_OFFLINE_CACHE",
      "M52_SESSION_REVOKED",
      "M52_REINSTALL_OFFLINE_SHELL",
    ].includes(event.data?.type)
  ) {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("amos-ops-m52-shell-"))
              .map((key) => caches.delete(key)),
          ),
        )
        .then(() =>
          event.ports?.[0]?.postMessage({
            type: "M52_OFFLINE_CACHE_PURGED",
            cacheVersion: M52_CACHE_VERSION,
          }),
        ),
    );
    return;
  }
  if (event.data?.type === "M52_REPORT_CACHE_VERSION")
    event.ports?.[0]?.postMessage({
      type: "M52_CACHE_VERSION",
      cacheVersion: M52_CACHE_VERSION,
    });
});

function m52IsApiRequest(url) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/trpc/");
}

function m52IsProtectedContent(url) {
  return M52_PROTECTED_PATH_PREFIXES.some((prefix) =>
    url.pathname.startsWith(prefix),
  );
}

function m52IsControlledShellAsset(request, url) {
  if (!request.referrer) return false;
  const referrer = new URL(request.referrer);
  if (referrer.origin !== self.location.origin || referrer.pathname !== M52_MANAGED_ROUTE)
    return false;
  if (M52_CONTROLLED_SHELL_PATHS.has(url.pathname)) return true;
  return (
    url.pathname.startsWith("/assets/") &&
    ["script", "style", "font"].includes(request.destination)
  );
}

async function m52RefreshShell() {
  const response = await fetch("/index.html", {
    cache: "no-cache",
    credentials: "same-origin",
  });
  if (response.ok) {
    const cache = await caches.open(M52_CACHE_VERSION);
    await cache.put("/index.html", response.clone());
  }
  return response;
}

async function m52OfflineFirstNavigation(event) {
  const cachedShell = await caches.match("/index.html");
  if (cachedShell) {
    event.waitUntil(m52RefreshShell().catch(() => undefined));
    return cachedShell;
  }
  return m52RefreshShell();
}

async function m52CacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(M52_CACHE_VERSION);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (
    url.origin !== self.location.origin ||
    m52IsApiRequest(url) ||
    m52IsProtectedContent(url)
  )
    return;

  if (request.mode === "navigate") {
    if (url.pathname !== M52_MANAGED_ROUTE) return;
    event.respondWith(m52OfflineFirstNavigation(event));
    return;
  }

  if (m52IsControlledShellAsset(request, url))
    event.respondWith(m52CacheFirstAsset(request));
});
