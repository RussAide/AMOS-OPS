const READ_ONLY_OPERATOR_DIAGNOSIS_PATHS = new Set([
  "/api/operator/identity/diagnosis",
  "/api/operator/operational-alerts/diagnosis",
]);

export function isReadOnlyOperatorDiagnosisRequest(
  method: string,
  pathname: string,
): boolean {
  return (
    method.toUpperCase() === "GET" &&
    READ_ONLY_OPERATOR_DIAGNOSIS_PATHS.has(pathname)
  );
}
