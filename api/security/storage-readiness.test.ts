import { describe, expect, it } from "vitest";
import { isStorageEncryptionInventoryReady } from "./storage-readiness";

describe("RM.2 storage readiness", () => {
  it("requires both upload scopes and the database-backup inventory in Production", () => {
    expect(
      isStorageEncryptionInventoryReady({
        production: true,
        uploadReportCount: 2,
        databaseBackupInventoryCompleted: true,
      }),
    ).toBe(true);
    for (const input of [
      {
        production: true,
        uploadReportCount: 1,
        databaseBackupInventoryCompleted: true,
      },
      {
        production: true,
        uploadReportCount: 2,
        databaseBackupInventoryCompleted: false,
      },
      {
        production: true,
        uploadReportCount: 3,
        databaseBackupInventoryCompleted: true,
      },
    ]) {
      expect(isStorageEncryptionInventoryReady(input)).toBe(false);
    }
  });

  it("does not require encrypted Production inventories outside Production", () => {
    expect(
      isStorageEncryptionInventoryReady({
        production: false,
        uploadReportCount: 0,
        databaseBackupInventoryCompleted: false,
      }),
    ).toBe(true);
  });
});
