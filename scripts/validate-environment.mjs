import "dotenv/config";
import path from "node:path";

const environments = new Set(["development", "demo", "staging", "production"]);
const appEnvironment =
  process.env.APP_ENV ||
  (process.env.NODE_ENV === "production" ? "production" : "development");
const runtimeMode =
  process.env.AMOS_RUNTIME_MODE ||
  (appEnvironment === "demo" ? "demo" : "production");
const productionPersistentRoot = "/app/persistent";
const persistentRoot =
  process.env.PERSISTENT_ROOT ||
  (appEnvironment === "production"
    ? productionPersistentRoot
    : path.join("data", appEnvironment));
const databasePath =
  process.env.DATABASE_PATH ||
  (appEnvironment === "production"
    ? path.join(persistentRoot, "data", appEnvironment, "amos-ops.db")
    : path.join("data", appEnvironment, "amos-ops.db"));
const trainingDatabasePath =
  process.env.TRAINING_DATABASE_PATH ||
  (appEnvironment === "production"
    ? path.join(
        persistentRoot,
        "data",
        appEnvironment,
        "training",
        "amos-ops-training.db",
      )
    : path.join("data", appEnvironment, "training", "amos-ops-training.db"));
const uploadPath =
  process.env.UPLOAD_PATH ||
  (appEnvironment === "production"
    ? path.join(persistentRoot, "uploads", appEnvironment)
    : path.join("uploads", appEnvironment));
const trainingUploadPath =
  process.env.TRAINING_UPLOAD_PATH ||
  (appEnvironment === "production"
    ? path.join(persistentRoot, "uploads", appEnvironment, "training")
    : path.join("uploads", appEnvironment, "training"));
const backupPath =
  process.env.BACKUP_PATH ||
  (appEnvironment === "production"
    ? path.join(persistentRoot, "backups", appEnvironment)
    : path.join("backups", appEnvironment));
const credentialNamespace =
  process.env.CREDENTIAL_NAMESPACE || `amos-ops/${appEnvironment}`;
const evaluationMode = runtimeMode === "demo";
const productionReleaseAuthorized = /^(?:1|true|yes|on)$/i.test(
  process.env.AMOS_PRODUCTION_RELEASE_AUTHORIZED || "",
);
const productionReleaseId =
  process.env.AMOS_PRODUCTION_RELEASE_ID?.trim() || "";
const reviewDeployment = /^(?:1|true|yes|on)$/i.test(
  process.env.AMOS_REVIEW_DEPLOYMENT || "",
);
const controlled =
  appEnvironment === "staging" || appEnvironment === "production";
const errors = [];
const validationComponent =
  process.env.AMOS_VALIDATION_COMPONENT?.trim().toLowerCase() || "backend";
const storageKeyFingerprints = new Set();

function isExactHttpOrigin(value) {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.origin === value
    );
  } catch {
    return false;
  }
}

function isPlaceholder(value) {
  return /^(?:change|replace|example|placeholder|your[-_])/i.test(value.trim());
}

function isStrictPathDescendant(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return (
    relative.length > 0 &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function validateStorageKeyring(domain) {
  const prefix = `AMOS_${domain.toUpperCase()}`;
  const activeKeyId = process.env[`${prefix}_ACTIVE_KEY_ID`]?.trim() || "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(activeKeyId)) {
    errors.push(`${prefix}_ACTIVE_KEY_ID is invalid.`);
    return;
  }
  const manifestVariable = `${prefix}_KEY_MANIFEST_JSON`;
  let manifest;
  try {
    manifest = JSON.parse(process.env[manifestVariable] || "");
  } catch {
    errors.push(`${manifestVariable} must be valid JSON.`);
    return;
  }
  if (!manifest || Array.isArray(manifest) || typeof manifest !== "object") {
    errors.push(`${manifestVariable} must be a JSON object.`);
    return;
  }
  const slotPattern = new RegExp(
    `^${prefix}_KEY_[A-Z][A-Z0-9_]{1,47}$`,
    "u",
  );
  if (!Object.hasOwn(manifest, activeKeyId)) {
    errors.push(
      `${manifestVariable} must contain the configured active key ID.`,
    );
    return;
  }
  const usedSlots = new Set();
  for (const [keyId, slotName] of Object.entries(manifest)) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(keyId)) {
      errors.push(`${manifestVariable} contains an invalid key ID.`);
      continue;
    }
    if (
      typeof slotName !== "string" ||
      !slotPattern.test(slotName) ||
      slotName === manifestVariable
    ) {
      errors.push(
        `${manifestVariable} must map each key ID to a dedicated ${prefix}_KEY_* variable.`,
      );
      continue;
    }
    if (usedSlots.has(slotName)) {
      errors.push(`${manifestVariable} must not reuse a sealed key slot.`);
      continue;
    }
    usedSlots.add(slotName);
    const encoded = process.env[slotName]?.trim() || "";
    const decoded = Buffer.from(encoded, "base64");
    if (decoded.length !== 32 || decoded.toString("base64") !== encoded) {
      errors.push(
        `${slotName} must contain canonical base64 for exactly 32 bytes.`,
      );
      continue;
    }
    const normalized = decoded.toString("base64");
    if (storageKeyFingerprints.has(normalized)) {
      errors.push("Storage key material must not be reused across domains.");
    }
    storageKeyFingerprints.add(normalized);
  }
}

if (!environments.has(appEnvironment))
  errors.push(`APP_ENV is invalid: ${appEnvironment}`);
if (!new Set(["demo", "production"]).has(runtimeMode))
  errors.push(`AMOS_RUNTIME_MODE is invalid: ${runtimeMode}`);
if (runtimeMode === "demo" && appEnvironment !== "demo")
  errors.push("AMOS_RUNTIME_MODE=demo requires APP_ENV=demo.");
if (appEnvironment === "demo" && runtimeMode !== "demo")
  errors.push("APP_ENV=demo requires AMOS_RUNTIME_MODE=demo.");
if (appEnvironment === "production" && runtimeMode !== "production")
  errors.push("APP_ENV=production requires AMOS_RUNTIME_MODE=production.");
if (process.env.VITE_AMOS_EVALUATION_MODE !== undefined)
  errors.push(
    "VITE_AMOS_EVALUATION_MODE is retired; set AMOS_RUNTIME_MODE at startup.",
  );
if (appEnvironment === "production" && process.env.NODE_ENV !== "production")
  errors.push("Production requires NODE_ENV=production.");
if (controlled && !databasePath.includes(appEnvironment))
  errors.push(`DATABASE_PATH must include ${appEnvironment}.`);
if (controlled && !uploadPath.includes(appEnvironment))
  errors.push(`UPLOAD_PATH must include ${appEnvironment}.`);
if (controlled && !credentialNamespace.toLowerCase().includes(appEnvironment))
  errors.push(`CREDENTIAL_NAMESPACE must include ${appEnvironment}.`);

if (controlled) {
  if (validationComponent !== "frontend") {
    for (const name of ["APP_SECRET", "JWT_SECRET"]) {
      const value = process.env[name] || "";
      if (value.length < 32 || isPlaceholder(value)) {
        errors.push(
          `${name} must be a non-placeholder secret of at least 32 characters.`,
        );
      }
    }
  }
  for (const name of [
    "DEPLOYMENT_APPROVAL_ID",
    "DEPLOYMENT_CHANGE_REFERENCE",
  ]) {
    if (!process.env[name])
      errors.push(`${name} is required for a controlled deployment.`);
  }
  const origins = (process.env.AMOS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!origins.length || origins.some((origin) => !isExactHttpOrigin(origin)))
    errors.push(
      "AMOS_ALLOWED_ORIGINS must contain exact http(s) origins without paths, queries, fragments, or wildcards.",
    );
}

if (appEnvironment === "production") {
  if (
    !path.isAbsolute(persistentRoot) ||
    path.resolve(persistentRoot) !== path.resolve(productionPersistentRoot)
  )
    errors.push(
      `Production PERSISTENT_ROOT must resolve to ${productionPersistentRoot}.`,
    );
  for (const [name, value] of [
    ["DATABASE_PATH", databasePath],
    ["TRAINING_DATABASE_PATH", trainingDatabasePath],
    ["UPLOAD_PATH", uploadPath],
    ["TRAINING_UPLOAD_PATH", trainingUploadPath],
    ["BACKUP_PATH", backupPath],
  ]) {
    if (
      !path.isAbsolute(value) ||
      !isStrictPathDescendant(persistentRoot, value)
    )
      errors.push(
        `${name} for production must be an absolute path beneath PERSISTENT_ROOT ${productionPersistentRoot}.`,
      );
  }
  if (/^(?:1|true|yes|on)$/i.test(process.env.ALLOW_SELF_REGISTRATION || ""))
    errors.push("Production requires ALLOW_SELF_REGISTRATION=false.");
  if ((process.env.MFA_POLICY || "required-privileged") !== "required-all")
    errors.push("Production requires MFA_POLICY=required-all.");
  if (
    !productionReleaseAuthorized ||
    !productionReleaseId ||
    isPlaceholder(productionReleaseId)
  )
    errors.push(
      "Production is locked until explicit release authorization and a non-placeholder release ID are supplied.",
    );
  if (
    validationComponent === "backend" ||
    validationComponent === "backend-ci"
  ) {
    if (
      !/^(?:1|true|yes|on)$/i.test(
        process.env.AMOS_STORAGE_ENCRYPTION_REQUIRED || "",
      )
    ) {
      errors.push("Production requires AMOS_STORAGE_ENCRYPTION_REQUIRED=true.");
    }
    if (
      (process.env.AMOS_STORAGE_KEY_PROVIDER || "") !==
      "railway-sealed-variables-v1"
    ) {
      errors.push(
        "Production requires AMOS_STORAGE_KEY_PROVIDER=railway-sealed-variables-v1.",
      );
    }
    const migrationMode = process.env.AMOS_STORAGE_MIGRATION_MODE || "none";
    if (!new Set(["none", "encrypt-plaintext", "rotate"]).has(migrationMode)) {
      errors.push("AMOS_STORAGE_MIGRATION_MODE is invalid.");
    }
    if (validationComponent === "backend") {
      for (const domain of ["database", "upload", "backup"]) {
        validateStorageKeyring(domain);
      }
    }
  }
} else if (productionReleaseAuthorized || productionReleaseId) {
  errors.push(
    "Production release authorization may be supplied only for APP_ENV=production.",
  );
}

if (reviewDeployment) {
  const ownerEmail =
    process.env.AMOS_FINAL_GATE_OWNER_EMAIL?.trim().toLowerCase() || "";
  const candidateId = process.env.AMOS_FINAL_GATE_CANDIDATE_ID?.trim() || "";
  const buildId = process.env.AMOS_BUILD_ID?.trim() || "";
  const sourceDigest =
    process.env.AMOS_SOURCE_DIGEST?.trim().toLowerCase() || "";
  const passwordHash =
    process.env.AMOS_REVIEW_OWNER_PASSWORD_HASH?.trim() || "";
  const mfaCode = process.env.AMOS_REVIEW_OWNER_MFA_CODE?.trim() || "";
  if (appEnvironment !== "staging" || runtimeMode !== "production")
    errors.push(
      "AMOS_REVIEW_DEPLOYMENT=true requires APP_ENV=staging and AMOS_RUNTIME_MODE=production.",
    );
  if (/^(?:1|true|yes|on)$/i.test(process.env.ALLOW_SELF_REGISTRATION || ""))
    errors.push("Release review requires ALLOW_SELF_REGISTRATION=false.");
  if ((process.env.MFA_POLICY || "required-privileged") !== "required-all")
    errors.push("Release review requires MFA_POLICY=required-all.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail))
    errors.push("AMOS_FINAL_GATE_OWNER_EMAIL must be a valid email address.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/.test(candidateId))
    errors.push("AMOS_FINAL_GATE_CANDIDATE_ID is invalid.");
  if (!buildId || isPlaceholder(buildId))
    errors.push("AMOS_BUILD_ID must be a non-placeholder build identifier.");
  if (!/^[a-f0-9]{64}$/.test(sourceDigest))
    errors.push("AMOS_SOURCE_DIGEST must be a lowercase SHA-256 digest.");
  if (!/^\$2[aby]\$\d{2}\$.{53}$/.test(passwordHash))
    errors.push("AMOS_REVIEW_OWNER_PASSWORD_HASH must be a bcrypt hash.");
  if (
    !/^\d{6}$/.test(mfaCode) ||
    new Set(["000000", "111111", "123456", "654321"]).has(mfaCode)
  )
    errors.push(
      "AMOS_REVIEW_OWNER_MFA_CODE must be a non-trivial six-digit code.",
    );
} else if (
  [
    "AMOS_FINAL_GATE_OWNER_EMAIL",
    "AMOS_FINAL_GATE_CANDIDATE_ID",
    "AMOS_SOURCE_DIGEST",
    "AMOS_REVIEW_OWNER_PASSWORD_HASH",
    "AMOS_REVIEW_OWNER_MFA_CODE",
  ].some((name) => Boolean(process.env[name]))
) {
  errors.push(
    "Final-gate owner and review bootstrap variables require AMOS_REVIEW_DEPLOYMENT=true.",
  );
}

if (errors.length) {
  console.error(
    JSON.stringify(
      { status: "invalid", appEnvironment, runtimeMode, errors },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: "valid",
      appEnvironment,
      runtimeMode,
      environmentId:
        process.env.AMOS_ENVIRONMENT_ID || `amos-ops-${appEnvironment}`,
      credentialNamespace,
      persistentRoot,
      databasePath,
      trainingDatabasePath,
      uploadPath,
      trainingUploadPath,
      backupPath,
      evaluationMode,
      productionReleaseAuthorized,
      productionReleaseId: productionReleaseId || null,
      reviewDeployment,
      deploymentApprovalRecorded: Boolean(process.env.DEPLOYMENT_APPROVAL_ID),
      deploymentChangeRecorded: Boolean(
        process.env.DEPLOYMENT_CHANGE_REFERENCE,
      ),
    },
    null,
    2,
  ),
);
