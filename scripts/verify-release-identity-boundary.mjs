import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const protectedNames = [
  "AMOS_ADMIN_RECOVERY_TOKEN",
  "AMOS_INITIAL_ADMIN_INVITATION_TOKEN_HASH",
  "AMOS_INITIAL_ADMIN_INVITATION_EXPIRES_AT",
];

function topLevelSection(source, key) {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const start = lines.findIndex((line) => new RegExp(`^${key}:`).test(line));
  if (start === -1) return "";
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^[A-Za-z0-9_.-]+:\s*/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function jobBlock(source, jobName) {
  const jobs = topLevelSection(source, "jobs");
  const lines = jobs.split("\n");
  const start = lines.findIndex((line) => line === `  ${jobName}:`);
  if (start === -1) return "";
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^  [A-Za-z0-9_-]+:\s*$/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function record(failures, condition, code) {
  if (!condition) failures.push(code);
}

export function verifyReleaseIdentityBoundary({
  workflowRoot = path.resolve(".github/workflows"),
  bootPath = path.resolve("api/boot.ts"),
} = {}) {
  const failures = [];
  const identityPath = path.join(workflowRoot, "identity-operations.yml");

  record(
    failures,
    fs.existsSync(identityPath),
    "identity-operations.yml:missing-protected-identity-workflow",
  );
  record(failures, fs.existsSync(bootPath), "api/boot.ts:missing-runtime-boundary");
  if (failures.length) return failures;

  for (const name of fs.readdirSync(workflowRoot)) {
    if (!/\.ya?ml$/.test(name) || name === "identity-operations.yml") continue;
    const content = fs.readFileSync(path.join(workflowRoot, name), "utf8");
    if (/railway\s+variable\s+set/i.test(content)) {
      failures.push(`${name}:release-must-not-set-railway-variables`);
    }
    for (const key of protectedNames) {
      if (content.includes(key)) failures.push(`${name}:protected-identity-key:${key}`);
    }
    if (/\/api\/operator\/identity\//.test(content)) {
      failures.push(`${name}:release-or-startup-must-not-call-identity-operator`);
    }
    if (/(?:workflow[s/]*)?identity-operations\.ya?ml/i.test(content)) {
      failures.push(`${name}:release-or-startup-must-not-dispatch-identity-workflow`);
    }
  }

  const identity = fs.readFileSync(identityPath, "utf8");
  const triggers = topLevelSection(identity, "on");
  const triggerNames = [...triggers.matchAll(/^  ([A-Za-z0-9_-]+):/gm)].map(
    (match) => match[1],
  );
  record(
    failures,
    triggerNames.length === 1 && triggerNames[0] === "workflow_dispatch",
    "identity-operations.yml:identity-workflow-must-be-manual-only",
  );
  record(
    failures,
    !/^\s+default:/m.test(triggers),
    "identity-operations.yml:identity-activation-must-not-have-defaults",
  );

  const diagnose = jobBlock(identity, "diagnose");
  const recovery = jobBlock(identity, "activate_recovery");
  record(failures, Boolean(diagnose), "identity-operations.yml:missing-diagnose-job");
  record(
    failures,
    Boolean(recovery),
    "identity-operations.yml:missing-activate-recovery-job",
  );

  if (diagnose) {
    record(
      failures,
      /if:\s*\$\{\{\s*inputs\.operation\s*==\s*'diagnose'\s*\}\}/.test(diagnose),
      "identity-operations.yml:diagnose-job-must-be-explicitly-conditioned",
    );
    record(
      failures,
      /APP_SECRET:\s*\$\{\{\s*secrets\.APP_SECRET\s*\}\}/.test(diagnose),
      "identity-operations.yml:diagnose-job-missing-app-secret",
    );
    record(
      failures,
      !/(?:AMOS_ADMIN_RECOVERY_TOKEN|RECOVERY_TOKEN|recovery_minutes|RECOVERY_MINUTES|activate-recovery)/.test(
        diagnose,
      ),
      "identity-operations.yml:diagnose-job-can-access-recovery-controls",
    );
    record(
      failures,
      /path=\/api\/operator\/identity\/diagnosis/.test(diagnose),
      "identity-operations.yml:diagnose-job-missing-diagnosis-path",
    );
    record(
      failures,
      /body=''/.test(diagnose) && !/--data(?:-raw)?\b/.test(diagnose),
      "identity-operations.yml:diagnosis-must-use-empty-body",
    );
    record(
      failures,
      /printf\s+'v1\\n%s\\n%s\\nGET\\n%s\\n%s'/.test(diagnose) &&
        /curl[^\n]*-X GET/.test(diagnose),
      "identity-operations.yml:diagnosis-must-be-signed-get",
    );
  }

  if (recovery) {
    record(
      failures,
      /if:\s*\$\{\{\s*inputs\.operation\s*==\s*'activate-recovery'\s*\}\}/.test(
        recovery,
      ),
      "identity-operations.yml:recovery-job-must-be-explicitly-conditioned",
    );
    record(
      failures,
      /AMOS_ADMIN_RECOVERY_TOKEN/.test(recovery) && /APP_SECRET/.test(recovery),
      "identity-operations.yml:recovery-job-missing-protected-inputs",
    );
    record(
      failures,
      /RECOVERY_MINUTES.*\^\[0-9\]\+\$/.test(recovery) &&
        /RECOVERY_MINUTES\s*<\s*1/.test(recovery) &&
        /RECOVERY_MINUTES\s*>\s*60/.test(recovery),
      "identity-operations.yml:recovery-minutes-must-validate-1-through-60",
    );
    record(
      failures,
      /path=\/api\/operator\/identity\/recovery/.test(recovery) &&
        /printf\s+'v1\\n%s\\n%s\\nPOST\\n%s\\n%s'/.test(recovery) &&
        /curl[^\n]*-X POST/.test(recovery),
      "identity-operations.yml:recovery-must-be-explicit-signed-post",
    );
  }

  const identityWithoutRecoveryJob = recovery ? identity.replace(recovery, "") : identity;
  for (const key of protectedNames) {
    record(
      failures,
      !identityWithoutRecoveryJob.includes(key),
      `identity-operations.yml:protected-key-outside-recovery-job:${key}`,
    );
  }

  const boot = fs.readFileSync(bootPath, "utf8");
  record(
    failures,
    /app\.get\(\s*["']\/api\/operator\/identity\/diagnosis["']/.test(boot),
    "api/boot.ts:diagnosis-route-must-be-get",
  );
  record(
    failures,
    !/app\.post\(\s*["']\/api\/operator\/identity\/diagnosis["']/.test(boot),
    "api/boot.ts:diagnosis-route-must-not-be-post",
  );

  return [...new Set(failures)].sort();
}

const isCli =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const failures = verifyReleaseIdentityBoundary();
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log("Release/identity boundary verified.");
}
