#!/usr/bin/env node
/**
 * validate-migration-fks.mjs
 *
 * Static analysis guard: walks migration SQL files in chronological order and
 * verifies that every REFERENCES "TableName" FK target was created (via
 * CREATE TABLE) in the same migration or an earlier one.
 *
 * Exits 1 if any forward/missing reference is found.
 * Run in CI to catch migration authoring errors before deployment.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = "prisma/migrations";

if (!existsSync(migrationsDir)) {
  console.error(`Migrations directory not found: ${migrationsDir}`);
  process.exit(1);
}

// Collect migration directories sorted lexicographically (timestamp prefix ensures order).
const migrations = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

// Accumulate created table names across all migrations seen so far.
const knownTables = new Set();
let errors = 0;

for (const migrationDir of migrations) {
  const sqlPath = join(migrationsDir, migrationDir, "migration.sql");
  if (!existsSync(sqlPath)) continue;

  const sql = readFileSync(sqlPath, "utf-8");

  // Discover tables created by this migration (quoted or unquoted identifiers).
  const createPattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([A-Za-z_][A-Za-z0-9_]*)"?/gi;
  let match;
  while ((match = createPattern.exec(sql)) !== null) {
    knownTables.add(match[1]);
  }

  // A repair migration may safely add an FK only when the target table exists.
  // Track REFERENCES targets guarded in the same DO block by:
  // IF to_regclass('"TargetTable"') IS NOT NULL
  const guardedReferenceBlocks = [];
  const doBlockPattern = /DO\s+\$\$([\s\S]*?)END\s+\$\$;/gi;
  let doBlockMatch;
  while ((doBlockMatch = doBlockPattern.exec(sql)) !== null) {
    const block = doBlockMatch[1];
    const guardedTables = new Set();
    const toRegclassPattern = /to_regclass\(\s*'\"?([A-Za-z_][A-Za-z0-9_]*)\"?'\s*\)\s+IS\s+NOT\s+NULL/gi;
    while ((match = toRegclassPattern.exec(block)) !== null) {
      guardedTables.add(match[1]);
    }

    if (guardedTables.size > 0) {
      guardedReferenceBlocks.push({
        start: doBlockMatch.index,
        end: doBlockMatch.index + doBlockMatch[0].length,
        tables: guardedTables,
      });
    }
  }

  // Verify every REFERENCES target is a known table (quoted or unquoted identifiers).
  // Matches: REFERENCES "TableName"( or REFERENCES TableName(
  const refPattern = /REFERENCES\s+"?([A-Za-z_][A-Za-z0-9_]*)"?\s*\(/gi;
  while ((match = refPattern.exec(sql)) !== null) {
    const table = match[1];
    const isGuarded = guardedReferenceBlocks.some(
      (block) => match.index >= block.start && match.index < block.end && block.tables.has(table),
    );
    if (!knownTables.has(table) && !isGuarded) {
      console.error(
        `[FAIL] ${migrationDir}: REFERENCES "${table}" — table not yet created in this or any earlier migration.`
      );
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\n${errors} FK reference error(s) found. Fix the migration chain before deploying.`);
  process.exit(1);
} else {
  console.log(`Migration FK validation passed (${migrations.length} migrations checked).`);
}
