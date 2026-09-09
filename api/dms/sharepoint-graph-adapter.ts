import { createHash } from "node:crypto";

export interface SharePointGraphConfig {
  enabled: boolean;
  tenantId: string | null;
  clientId: string | null;
  clientSecret: string | null;
  tenantHost: string | null;
  siteId: string | null;
  allowedDriveIds: readonly string[];
  writesEnabled: boolean;
}

export interface SharePointGraphItemSnapshot {
  tenantHost: string;
  siteId: string;
  driveId: string;
  itemId: string;
  name: string;
  webUrl: string;
  parentItemId: string | null;
  relativePath: string | null;
  versionId: string | null;
  eTag: string | null;
  cTag: string | null;
  sizeBytes: number | null;
  contentHash: string | null;
  metadataHash: string;
  lastModifiedAt: string | null;
}

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GraphDriveItemResponse {
  id?: string;
  name?: string;
  webUrl?: string;
  eTag?: string;
  cTag?: string;
  size?: number;
  lastModifiedDateTime?: string;
  parentReference?: {
    id?: string;
    driveId?: string;
    path?: string;
    siteId?: string;
  };
  file?: {
    hashes?: {
      sha1Hash?: string;
      sha256Hash?: string;
      quickXorHash?: string;
    };
  };
}

const ENABLED = new Set(["1", "true", "yes", "on"]);

function flag(value: string | undefined): boolean {
  return ENABLED.has(value?.trim().toLowerCase() ?? "");
}

function splitCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function loadSharePointGraphConfig(
  env: NodeJS.ProcessEnv = process.env,
): SharePointGraphConfig {
  const enabled = flag(env.AMOS_SHAREPOINT_GRAPH_ENABLED);
  const config: SharePointGraphConfig = {
    enabled,
    tenantId: env.AMOS_SHAREPOINT_TENANT_ID?.trim() || null,
    clientId: env.AMOS_SHAREPOINT_CLIENT_ID?.trim() || null,
    clientSecret: env.AMOS_SHAREPOINT_CLIENT_SECRET?.trim() || null,
    tenantHost: env.AMOS_SHAREPOINT_TENANT_HOST?.trim().toLowerCase() || null,
    siteId: env.AMOS_SHAREPOINT_SITE_ID?.trim() || null,
    allowedDriveIds: splitCsv(env.AMOS_SHAREPOINT_ALLOWED_DRIVE_IDS),
    writesEnabled: flag(env.AMOS_SHAREPOINT_WRITE_ENABLED),
  };

  if (!enabled) return config;
  if (config.writesEnabled)
    throw new Error("SHAREPOINT_GRAPH_WRITES_NOT_AUTHORIZED");
  if (
    !config.tenantId ||
    !config.clientId ||
    !config.clientSecret ||
    !config.tenantHost ||
    !config.siteId ||
    config.allowedDriveIds.length === 0
  ) {
    throw new Error("SHAREPOINT_GRAPH_CONFIGURATION_INCOMPLETE");
  }
  return config;
}

export function sharePointBridgeStatus(
  env: NodeJS.ProcessEnv = process.env,
): {
  configured: boolean;
  connected: false;
  verification: "NOT_CONFIGURED" | "CONFIGURED_NOT_PROBED";
  tenantHost: string | null;
  siteId: string | null;
  allowedDriveCount: number;
  writesEnabled: boolean;
} {
  const config = loadSharePointGraphConfig(env);
  return {
    configured: config.enabled,
    connected: false,
    verification: config.enabled ? "CONFIGURED_NOT_PROBED" : "NOT_CONFIGURED",
    tenantHost: config.tenantHost,
    siteId: config.siteId,
    allowedDriveCount: config.allowedDriveIds.length,
    writesEnabled: config.writesEnabled,
  };
}

function assertSafeIdentifier(value: string, code: string): void {
  if (!value.trim() || /[/?#\\]/.test(value)) throw new Error(code);
}

function hashMetadata(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export class SharePointGraphAdapter {
  constructor(
    private readonly config: SharePointGraphConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!config.enabled) throw new Error("SHAREPOINT_GRAPH_NOT_CONFIGURED");
  }

  private assertAddress(driveId: string, itemId: string): void {
    assertSafeIdentifier(driveId, "SHAREPOINT_GRAPH_DRIVE_ID_INVALID");
    assertSafeIdentifier(itemId, "SHAREPOINT_GRAPH_ITEM_ID_INVALID");
    if (!this.config.allowedDriveIds.includes(driveId))
      throw new Error("SHAREPOINT_GRAPH_DRIVE_NOT_ALLOWED");
  }

  private async accessToken(): Promise<string> {
    if (!this.config.tenantId || !this.config.clientId || !this.config.clientSecret)
      throw new Error("SHAREPOINT_GRAPH_CONFIGURATION_INCOMPLETE");

    const endpoint = `https://login.microsoftonline.com/${encodeURIComponent(
      this.config.tenantId,
    )}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });
    const response = await this.fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const payload = (await response.json()) as TokenResponse;
    if (!response.ok || !payload.access_token)
      throw new Error(
        `SHAREPOINT_GRAPH_TOKEN_FAILED:${payload.error ?? response.status}`,
      );
    return payload.access_token;
  }

  async getItemMetadata(
    driveId: string,
    itemId: string,
  ): Promise<SharePointGraphItemSnapshot> {
    this.assertAddress(driveId, itemId);
    if (!this.config.tenantHost || !this.config.siteId)
      throw new Error("SHAREPOINT_GRAPH_CONFIGURATION_INCOMPLETE");

    const token = await this.accessToken();
    const endpoint = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
      driveId,
    )}/items/${encodeURIComponent(
      itemId,
    )}?$select=id,name,webUrl,eTag,cTag,size,lastModifiedDateTime,parentReference,file`;
    const response = await this.fetchImpl(endpoint, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok)
      throw new Error(`SHAREPOINT_GRAPH_ITEM_LOOKUP_FAILED:${response.status}`);
    const item = (await response.json()) as GraphDriveItemResponse;
    if (item.id !== itemId) throw new Error("SHAREPOINT_GRAPH_ITEM_ID_MISMATCH");
    if (item.parentReference?.driveId && item.parentReference.driveId !== driveId)
      throw new Error("SHAREPOINT_GRAPH_DRIVE_ID_MISMATCH");
    if (item.parentReference?.siteId && item.parentReference.siteId !== this.config.siteId)
      throw new Error("SHAREPOINT_GRAPH_SITE_ID_MISMATCH");
    if (!item.webUrl || !item.name)
      throw new Error("SHAREPOINT_GRAPH_ITEM_METADATA_INCOMPLETE");

    let web: URL;
    try {
      web = new URL(item.webUrl);
    } catch {
      throw new Error("SHAREPOINT_GRAPH_ITEM_WEB_URL_INVALID");
    }
    if (web.protocol !== "https:" || web.hostname.toLowerCase() !== this.config.tenantHost)
      throw new Error("SHAREPOINT_GRAPH_ITEM_TENANT_MISMATCH");

    const contentHash =
      item.file?.hashes?.sha256Hash ??
      item.file?.hashes?.sha1Hash ??
      item.file?.hashes?.quickXorHash ??
      null;
    const relativePath = item.parentReference?.path ?? null;
    const snapshot = {
      tenantHost: this.config.tenantHost,
      siteId: this.config.siteId,
      driveId,
      itemId,
      name: item.name,
      webUrl: item.webUrl,
      parentItemId: item.parentReference?.id ?? null,
      relativePath,
      versionId: null,
      eTag: item.eTag ?? null,
      cTag: item.cTag ?? null,
      sizeBytes: typeof item.size === "number" ? item.size : null,
      contentHash,
      lastModifiedAt: item.lastModifiedDateTime ?? null,
    };

    return {
      ...snapshot,
      metadataHash: hashMetadata(snapshot),
    };
  }

  async downloadItemContent(
    driveId: string,
    itemId: string,
  ): Promise<Uint8Array> {
    this.assertAddress(driveId, itemId);
    const token = await this.accessToken();
    const endpoint = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
      driveId,
    )}/items/${encodeURIComponent(itemId)}/content`;
    const response = await this.fetchImpl(endpoint, {
      headers: { authorization: `Bearer ${token}` },
      redirect: "follow",
    });
    if (!response.ok)
      throw new Error(
        `SHAREPOINT_GRAPH_CONTENT_RETRIEVAL_FAILED:${response.status}`,
      );
    return new Uint8Array(await response.arrayBuffer());
  }

}
