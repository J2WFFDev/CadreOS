#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const BUILTIN_SCALARS = new Set([
  "String",
  "Boolean",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "DateTime",
  "Json",
  "Bytes",
  "Unsupported",
]);

const BASELINE_MIGRATION_MARKERS = [
  {
    migration: "20260525000000_initial_cadreos_core",
    requires: [
      { table: "Organization" },
      { table: "Program" },
      { table: "Team" },
      { table: "Season" },
      { table: "UserAccount" },
      { table: "Person" },
      { table: "RoleAssignment" },
      { table: "AthleteGuardianRelationship" },
      { table: "RosterMembership" },
      { table: "ObservationNote" },
      { table: "EntryRuntimeRef" },
      { table: "Event" },
      { table: "RSVP" },
      { table: "AttendanceRecord" },
      { table: "FollowUpTask" },
      { table: "InboxRoutingItem" },
      { table: "AuditEvent" },
      { table: "Facility" },
      { table: "FacilityResource" },
      { table: "ResourceBooking" },
      { table: "BookingConflict" },
    ],
  },
  {
    migration: "20260525153000_entry_system",
    requires: [
      { table: "Entry" },
      { table: "EntryLink" },
      { table: "EntryActivity" },
    ],
  },
  {
    migration: "20260526004640_arc19a_operational_entry_architecture",
    requires: [
      { table: "EntryObjectLink" },
      { table: "EntryAssignment" },
      { table: "EntryStatusHistory" },
      { table: "EntryComment" },
      { table: "EntryReminder" },
      { table: "Entry", column: "updatedByPersonId" },
    ],
  },
  {
    migration: "20260526014000_arc19d_operational_graph",
    requires: [{ table: "OperationalRelationship" }],
  },
  {
    migration: "20260526020000_arc19e_workflow_orchestration",
    requires: [{ table: "WorkflowTemplate" }, { table: "WorkflowRun" }, { table: "WorkflowStepEntry" }],
  },
  {
    migration: "20260526024000_arc19f_notifications_activity",
    requires: [
      { table: "AwarenessEvent" },
      { table: "Notification" },
      { table: "NotificationReadState" },
      { table: "NotificationPreference" },
      { table: "NotificationDigest" },
    ],
  },
];

const PROTECTED_MIGRATION_MARKERS = [
  {
    migration: "20260526143000_add_person_lifecycle_status",
    requires: [{ table: "Person", column: "lifecycleStatus" }],
  },
  {
    migration: "20260526152000_add_gearops_core_tables",
    requires: [{ table: "GearCategory" }, { table: "GearItem" }, { table: "GearAssignment" }, { table: "GearCheckout" }],
  },
  {
    migration: "20260527133000_add_gearcategory_configuration_columns",
    requires: [
      { table: "GearCategory", column: "templateSlug" },
      { table: "GearCategory", column: "behaviorType" },
      { table: "GearCategory", column: "custodyMode" },
      { table: "GearCategory", column: "primaryIdentifierType" },
      { table: "GearCategory", column: "reportGroup" },
      { table: "GearCategory", column: "supportsEventDeployment" },
    ],
  },
];

function parseArgs(argv) {
  const out = {
    live: "",
    target: "prisma/schema.prisma",
    selected: "",
    format: "text",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === "--live") {
      out.live = val;
      i += 1;
    } else if (key === "--target") {
      out.target = val;
      i += 1;
    } else if (key === "--selected") {
      out.selected = val;
      i += 1;
    } else if (key === "--format") {
      out.format = val;
      i += 1;
    }
  }

  if (!out.live) {
    throw new Error("Missing required --live <path> argument.");
  }
  return out;
}

function readText(filePath) {
  return fs.readFileSync(path.resolve(filePath), "utf8");
}

function parsePrismaSchema(schemaText) {
  const lines = schemaText.split(/\r?\n/);
  const enums = new Set();
  const modelNames = new Set();
  for (const line of lines) {
    const enumMatch = line.match(/^\s*enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/);
    if (enumMatch) enums.add(enumMatch[1]);
    const modelMatch = line.match(/^\s*model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/);
    if (modelMatch) modelNames.add(modelMatch[1]);
  }

  const models = new Map();
  let current = null;
  let currentBody = [];

  function flushModel() {
    if (!current) return;
    const body = currentBody;
    const mapLine = body.find((l) => /^\s*@@map\(".*"\)/.test(l));
    const mapMatch = mapLine ? mapLine.match(/@@map\("([^"]+)"\)/) : null;
    const tableName = mapMatch ? mapMatch[1] : current;
    const columnsLogical = new Set();
    const columnsDatabase = new Set();

    for (const line of body) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("@@")) {
        continue;
      }
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) continue;
      const fieldName = parts[0];
      const typeToken = parts[1].replace(/[?[\]]/g, "");
      const isScalarLike =
        BUILTIN_SCALARS.has(typeToken) ||
        enums.has(typeToken) ||
        typeToken.startsWith("Unsupported(");

      if (!isScalarLike) continue;
      if (trimmed.includes("@relation(")) continue;

      const colMapMatch = trimmed.match(/@map\("([^"]+)"\)/);
      const dbColumn = colMapMatch ? colMapMatch[1] : fieldName;
      columnsLogical.add(fieldName);
      columnsDatabase.add(dbColumn);
    }

    models.set(current, {
      modelName: current,
      tableName,
      columnsLogical,
      columnsDatabase,
    });
    current = null;
    currentBody = [];
  }

  for (const line of lines) {
    const modelStart = line.match(/^\s*model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/);
    if (modelStart) {
      flushModel();
      current = modelStart[1];
      currentBody = [];
      continue;
    }
    if (current && /^\s*}\s*$/.test(line)) {
      flushModel();
      continue;
    }
    if (current) {
      currentBody.push(line);
    }
  }
  flushModel();

  const byTable = new Map();
  for (const model of models.values()) {
    byTable.set(model.tableName, model);
  }

  return {
    models,
    byTable,
  };
}

function markerSatisfied(schema, marker) {
  const tableModel = schema.byTable.get(marker.table) || schema.models.get(marker.table);
  if (!tableModel) {
    return { ok: false, reason: `missing table ${marker.table}` };
  }
  if (!marker.column) {
    return { ok: true };
  }
  const hasColumn =
    tableModel.columnsDatabase.has(marker.column) || tableModel.columnsLogical.has(marker.column);
  if (!hasColumn) {
    return { ok: false, reason: `missing column ${marker.table}.${marker.column}` };
  }
  return { ok: true };
}

function evaluateMigrationMarkers(schema, specs) {
  return specs.map((spec) => {
    const checks = spec.requires.map((req) => ({ req, ...markerSatisfied(schema, req) }));
    return {
      migration: spec.migration,
      ok: checks.every((c) => c.ok),
      checks,
    };
  });
}

function resolveBaselineCandidates(migrationStates) {
  const contiguous = [];
  for (const state of migrationStates) {
    if (!state.ok) break;
    contiguous.push(state.migration);
  }
  return contiguous;
}

function classifyDatabase(tableNames) {
  const t = new Set(tableNames);
  const nonPrismaTables = tableNames.filter((name) => !name.startsWith("_prisma_"));
  const hasAny = (names) => names.some((n) => t.has(n));

  const authTables = ["Organization", "Person", "RoleAssignment", "UserAccount"];
  const legacyDomainTables = ["Program", "Team", "Season", "Event", "FollowUpTask", "ObservationNote"];
  const arc19Tables = ["Entry", "EntryObjectLink", "OperationalRelationship", "WorkflowTemplate", "Notification"];

  if (nonPrismaTables.length === 0) {
    return "mistaken/empty-ish database";
  }
  if (hasAny(authTables) && !hasAny(legacyDomainTables) && !hasAny(arc19Tables)) {
    return "auth-only schema";
  }
  if (hasAny(legacyDomainTables) && !hasAny(arc19Tables)) {
    return "older CadreOS schema";
  }
  if (!hasAny(legacyDomainTables) && !hasAny(arc19Tables) && nonPrismaTables.length <= 4) {
    return "seed-only/legacy schema";
  }
  if (hasAny(arc19Tables)) {
    return "partially migrated Arc-19+ schema";
  }
  return "seed-only/legacy schema";
}

function compareTargetToLive(liveSchema, targetSchema) {
  const missingTables = [];
  const missingColumnsByTable = {};

  for (const targetTable of targetSchema.byTable.keys()) {
    if (!liveSchema.byTable.has(targetTable)) {
      missingTables.push(targetTable);
      continue;
    }
    const liveModel = liveSchema.byTable.get(targetTable);
    const targetModel = targetSchema.byTable.get(targetTable);
    const missingCols = [];
    for (const col of targetModel.columnsDatabase) {
      if (!liveModel.columnsDatabase.has(col)) missingCols.push(col);
    }
    if (missingCols.length) {
      missingColumnsByTable[targetTable] = missingCols.sort();
    }
  }

  return {
    missingTables: missingTables.sort(),
    missingColumnsByTable,
  };
}

function determineNextAction({ tableNames, baselineEligibleMigrations, baselineStates, classification }) {
  const nonPrismaTables = tableNames.filter((name) => !name.startsWith("_prisma_"));
  if (nonPrismaTables.length === 0) {
    return "Option B candidate: DB appears empty-ish. Use a controlled reset/rebuild only with explicit approval.";
  }
  if (baselineEligibleMigrations.length === 0) {
    const firstBlocked = baselineStates.find((s) => !s.ok);
    return `Option C first: do not baseline. Apply pending migrations on live schema (or add compatibility migration before deploy) starting with ${firstBlocked?.migration || "first migration"}.`;
  }
  if (baselineEligibleMigrations.length < BASELINE_MIGRATION_MARKERS.length) {
    return "Option A/C hybrid: baseline only verified existing historical migrations, then apply remaining migrations with deploy.";
  }
  if (classification === "partially migrated Arc-19+ schema") {
    return "Option A: historical core and Arc-19 baseline markers are present. Baseline verified historical migrations, then deploy pending protected migrations.";
  }
  return "Option C: run migrate deploy carefully and add compatibility migration only for concrete conflicts.";
}

function formatMarkerRequirement(req) {
  return req.column ? `${req.table}.${req.column}` : req.table;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const liveSchema = parsePrismaSchema(readText(args.live));
  const targetSchema = parsePrismaSchema(readText(args.target));

  const tableNames = [...liveSchema.byTable.keys()].sort();
  const baselineStates = evaluateMigrationMarkers(liveSchema, BASELINE_MIGRATION_MARKERS);
  const protectedStates = evaluateMigrationMarkers(liveSchema, PROTECTED_MIGRATION_MARKERS);
  const baselineEligibleMigrations = resolveBaselineCandidates(baselineStates);
  const comparison = compareTargetToLive(liveSchema, targetSchema);
  const classification = classifyDatabase(tableNames);

  let selectedState = null;
  let selectedSatisfiable = false;
  let selectedResolveList = [];
  if (args.selected) {
    selectedState = baselineStates.find((s) => s.migration === args.selected) || null;
    if (selectedState) {
      selectedSatisfiable = baselineEligibleMigrations.includes(args.selected);
      if (selectedSatisfiable) {
        selectedResolveList = baselineEligibleMigrations.slice(
          0,
          baselineEligibleMigrations.indexOf(args.selected) + 1,
        );
      }
    }
  }

  const result = {
    tableCount: tableNames.length,
    tables: tableNames,
    classification,
    baselineStates: baselineStates.map((s) => ({
      migration: s.migration,
      ok: s.ok,
      missing: s.checks.filter((c) => !c.ok).map((c) => formatMarkerRequirement(c.req)),
    })),
    protectedStates: protectedStates.map((s) => ({
      migration: s.migration,
      ok: s.ok,
      missing: s.checks.filter((c) => !c.ok).map((c) => formatMarkerRequirement(c.req)),
    })),
    baselineEligibleMigrations,
    selectedBoundary: args.selected || null,
    selectedBoundarySatisfiable: selectedSatisfiable,
    selectedResolveList,
    targetComparison: {
      missingTableCount: comparison.missingTables.length,
      missingTables: comparison.missingTables,
      missingColumnsByTable: comparison.missingColumnsByTable,
    },
    nextRecommendedAction: determineNextAction({
      tableNames,
      baselineEligibleMigrations,
      baselineStates,
      classification,
    }),
  };

  if (args.format === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("Live database schema inventory (safe):");
  console.log(`- Tables found: ${result.tableCount}`);
  for (const table of result.tables) {
    console.log(`  - ${table}`);
  }

  console.log("\nMigration markers:");
  for (const state of result.baselineStates) {
    console.log(`- ${state.migration}: ${state.ok ? "present" : "missing markers"}`);
    for (const missing of state.missing) {
      console.log(`  - missing: ${missing}`);
    }
  }

  console.log("\nProtected migration markers:");
  for (const state of result.protectedStates) {
    console.log(`- ${state.migration}: ${state.ok ? "already present" : "pending markers"}`);
    for (const missing of state.missing) {
      console.log(`  - missing: ${missing}`);
    }
  }

  console.log(`\nClassification: ${result.classification}`);
  console.log(`Baseline-eligible contiguous migrations: ${result.baselineEligibleMigrations.join(", ") || "(none)"}`);
  if (result.selectedBoundary) {
    console.log(`Selected boundary: ${result.selectedBoundary}`);
    console.log(`Selected boundary satisfiable: ${result.selectedBoundarySatisfiable ? "yes" : "no"}`);
    if (result.selectedResolveList.length) {
      console.log(`Resolve list: ${result.selectedResolveList.join(", ")}`);
    }
  }

  console.log(`\nTarget schema comparison: ${result.targetComparison.missingTableCount} missing target tables in live DB.`);
  const missingColumnTables = Object.keys(result.targetComparison.missingColumnsByTable);
  console.log(`Tables missing one or more target columns: ${missingColumnTables.length}`);
  for (const table of missingColumnTables.sort()) {
    console.log(`- ${table}: ${result.targetComparison.missingColumnsByTable[table].join(", ")}`);
  }
  console.log(`Next recommended action: ${result.nextRecommendedAction}`);
}

main();
