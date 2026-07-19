import fs from "node:fs";
import path from "node:path";

const workflowRoot = path.resolve(".github/workflows");
const protectedNames = [
  "AMOS_ADMIN_RECOVERY_TOKEN",
  "AMOS_INITIAL_ADMIN_INVITATION_TOKEN_HASH",
  "AMOS_INITIAL_ADMIN_INVITATION_EXPIRES_AT",
];
const failures = [];
for (const name of fs.readdirSync(workflowRoot)) {
  if (!/\.ya?ml$/.test(name) || name === "identity-operations.yml") continue;
  const content = fs.readFileSync(path.join(workflowRoot, name), "utf8");
  if (/railway\s+variable\s+set/i.test(content)) failures.push(`${name}:release-must-not-set-railway-variables`);
  for (const key of protectedNames) {
    if (content.includes(key)) failures.push(`${name}:protected-identity-key:${key}`);
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Release/identity boundary verified.");
