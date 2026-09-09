import { describe, expect, it, vi } from "vitest";
import {
  loadSharePointGraphConfig,
  sharePointBridgeStatus,
  SharePointGraphAdapter,
} from "../dms/sharepoint-graph-adapter";

function configured() {
  return loadSharePointGraphConfig({
    AMOS_SHAREPOINT_GRAPH_ENABLED: "true",
    AMOS_SHAREPOINT_TENANT_ID: "tenant-id",
    AMOS_SHAREPOINT_CLIENT_ID: "client-id",
    AMOS_SHAREPOINT_CLIENT_SECRET: "client-secret",
    AMOS_SHAREPOINT_TENANT_HOST: "adolbi.sharepoint.com",
    AMOS_SHAREPOINT_SITE_ID: "site-cypress-gro",
    AMOS_SHAREPOINT_ALLOWED_DRIVE_IDS: "drive-documents",
  });
}

describe("S2 Microsoft Graph SharePoint adapter", () => {
  it("reports unconfigured rather than falsely connected by default", () => {
    expect(sharePointBridgeStatus({})).toEqual({
      configured: false,
      connected: false,
      verification: "NOT_CONFIGURED",
      tenantHost: null,
      siteId: null,
      allowedDriveCount: 0,
      writesEnabled: false,
    });
  });

  it("rejects SharePoint write enablement because S2 is verification-only", () => {
    expect(() =>
      loadSharePointGraphConfig({
        AMOS_SHAREPOINT_GRAPH_ENABLED: "true",
        AMOS_SHAREPOINT_TENANT_ID: "tenant-id",
        AMOS_SHAREPOINT_CLIENT_ID: "client-id",
        AMOS_SHAREPOINT_CLIENT_SECRET: "client-secret",
        AMOS_SHAREPOINT_TENANT_HOST: "adolbi.sharepoint.com",
        AMOS_SHAREPOINT_SITE_ID: "site-cypress-gro",
        AMOS_SHAREPOINT_ALLOWED_DRIVE_IDS: "drive-documents",
        AMOS_SHAREPOINT_WRITE_ENABLED: "true",
      }),
    ).toThrow("SHAREPOINT_GRAPH_WRITES_NOT_AUTHORIZED");
  });

  it("fails startup configuration when Graph is enabled without required credentials or allowlists", () => {
    expect(() =>
      loadSharePointGraphConfig({ AMOS_SHAREPOINT_GRAPH_ENABLED: "true" }),
    ).toThrow("SHAREPOINT_GRAPH_CONFIGURATION_INCOMPLETE");
  });

  it("rejects a drive outside the configured allowlist before any network request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const adapter = new SharePointGraphAdapter(configured(), fetchImpl);
    await expect(adapter.getItemMetadata("drive-other", "item-001")).rejects.toThrow(
      "SHAREPOINT_GRAPH_DRIVE_NOT_ALLOWED",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("server-verifies and normalizes exact Graph item metadata", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "test-token", token_type: "Bearer" }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "item-001",
            name: "Synthetic Supervision Plan.pdf",
            webUrl: "https://adolbi.sharepoint.com/sites/CypressGRO/Shared%20Documents/Synthetic%20Supervision%20Plan.pdf",
            eTag: "etag-1",
            cTag: "ctag-1",
            size: 1234,
            lastModifiedDateTime: "2026-09-09T10:00:00Z",
            parentReference: {
              id: "parent-1",
              driveId: "drive-documents",
              siteId: "site-cypress-gro",
              path: "/drive/root:/Clinical",
            },
            file: { hashes: { sha1Hash: "sha1-content" } },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    const adapter = new SharePointGraphAdapter(configured(), fetchImpl);
    const item = await adapter.getItemMetadata("drive-documents", "item-001");
    expect(item.itemId).toBe("item-001");
    expect(item.siteId).toBe("site-cypress-gro");
    expect(item.contentHash).toBe("sha1-content");
    expect(item.metadataHash).toMatch(/^[a-f0-9]{64}$/);
    const itemCall = fetchImpl.mock.calls[1];
    expect(itemCall?.[0]).toContain("/drives/drive-documents/items/item-001");
    expect((itemCall?.[1]?.headers as Record<string, string>).authorization).toBe(
      "Bearer test-token",
    );
  });

  it("rejects a Graph object that resolves outside the configured Cypress site", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "item-001",
            name: "Wrong Site.pdf",
            webUrl: "https://adolbi.sharepoint.com/sites/CypressGRO/Shared%20Documents/Wrong%20Site.pdf",
            parentReference: {
              driveId: "drive-documents",
              siteId: "site-other",
            },
          }),
          { status: 200 },
        ),
      );
    const adapter = new SharePointGraphAdapter(configured(), fetchImpl);
    await expect(adapter.getItemMetadata("drive-documents", "item-001")).rejects.toThrow(
      "SHAREPOINT_GRAPH_SITE_ID_MISMATCH",
    );
  });
});
