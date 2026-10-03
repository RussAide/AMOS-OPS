const LINE_COMMENT = /^\s*--.*$/gm;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const ADDITIVE_STATEMENT = /^CREATE\s+(?:TABLE|(?:UNIQUE\s+)?INDEX)\b/i;

export function isStrictlyAdditiveMigrationSql(sql: string): boolean {
  const statements = sql
    .replace(BLOCK_COMMENT, "")
    .replace(LINE_COMMENT, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  return (
    statements.length > 0 &&
    statements.every((statement) => ADDITIVE_STATEMENT.test(statement))
  );
}
