import { strict as assert } from "node:assert";
import test from "node:test";

import { summarizeGearOpsItemsReadiness, type GearOpsItemsDependencyStatus } from "../../lib/gear-ops-items-diagnostics";

function makeStatus(input: Partial<GearOpsItemsDependencyStatus> & Pick<GearOpsItemsDependencyStatus, "key">): GearOpsItemsDependencyStatus {
  return {
    key: input.key,
    label: input.label ?? input.key,
    operation: input.operation ?? "gearops.test",
    dependency: input.dependency ?? "required",
    available: input.available ?? true,
    diagnostic: input.diagnostic ?? null,
  };
}

test("required dependency failure blocks GearOps items readiness", () => {
  const summary = summarizeGearOpsItemsReadiness({
    baseSchemaAvailable: true,
    statuses: [
      makeStatus({ key: "itemsSchema", available: true }),
      makeStatus({
        key: "categories",
        available: false,
        dependency: "required",
        diagnostic: {
          ok: false,
          code: "GEAROPS_SCHEMA_GEARCATEGORY_FAILED",
          message: "failed",
          hint: "hint",
          dependency: "required",
          operation: "gearops.categories.load",
          prismaCode: "P2021",
        },
      }),
    ],
  });

  assert.equal(summary.requiredReady, false);
  assert.equal(summary.requiredFailures.length, 1);
});

test("optional dependency failure does not block GearOps items readiness", () => {
  const summary = summarizeGearOpsItemsReadiness({
    baseSchemaAvailable: true,
    statuses: [
      makeStatus({ key: "itemsSchema", available: true }),
      makeStatus({ key: "itemsLoad", available: true }),
      makeStatus({
        key: "templates",
        available: false,
        dependency: "optional",
        diagnostic: {
          ok: false,
          code: "GEAROPS_TEMPLATES_OPTIONAL_FAILED",
          message: "failed",
          hint: "hint",
          dependency: "optional",
          operation: "gearops.templates.load",
          prismaCode: "P2021",
        },
      }),
    ],
  });

  assert.equal(summary.requiredReady, true);
  assert.equal(summary.optionalFailures.length, 1);
});

test("empty GearOps data can still be marked load-ready", () => {
  const summary = summarizeGearOpsItemsReadiness({
    baseSchemaAvailable: true,
    statuses: [
      makeStatus({ key: "itemsSchema", available: true }),
      makeStatus({ key: "itemsLoad", available: true, dependency: "required" }),
      makeStatus({ key: "categories", available: true, dependency: "required" }),
    ],
  });

  assert.equal(summary.requiredReady, true);
  assert.equal(summary.itemsLoadAvailable, true);
});
