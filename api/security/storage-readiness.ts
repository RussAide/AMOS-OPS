export function isStorageEncryptionInventoryReady(input: {
  readonly production: boolean;
  readonly uploadReportCount: number;
  readonly databaseBackupInventoryCompleted: boolean;
}): boolean {
  return (
    !input.production ||
    (input.uploadReportCount === 2 &&
      input.databaseBackupInventoryCompleted)
  );
}
