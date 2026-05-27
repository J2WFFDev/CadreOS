import { strict as assert } from "node:assert";
import test from "node:test";

import { logDatabaseDiagnostic } from "../../lib/db/diagnostics";

test("logDatabaseDiagnostic redacts connection strings from development client message", () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previous = process.env.NODE_ENV;
  mutableEnv.NODE_ENV = "development";

  const result = logDatabaseDiagnostic({
    module: "GearOps",
    route: "/gear-ops/items",
    operation: "gearops.items.load",
    dependency: "required",
    error: new Error("connect failed postgres://user:password@localhost:5432/db"),
    code: "GEAROPS_ITEMS_LOAD_FAILED",
    clientMessage: "GearOps items could not be loaded.",
    model: "GearItem",
    table: "GearItem",
    queryType: "findMany",
  });

  assert.equal(result.ok, false);
  assert.ok(result.message.includes("[REDACTED_CONNECTION_STRING]"));

  mutableEnv.NODE_ENV = previous;
});

test("logDatabaseDiagnostic keeps production client message safe and short", () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previous = process.env.NODE_ENV;
  mutableEnv.NODE_ENV = "production";

  const result = logDatabaseDiagnostic({
    module: "GearOps",
    route: "/gear-ops/items",
    operation: "gearops.items.load",
    dependency: "required",
    error: new Error("sensitive postgres://user:password@localhost:5432/db"),
    code: "GEAROPS_ITEMS_LOAD_FAILED",
    clientMessage: "GearOps items could not be loaded.",
  });

  assert.equal(result.message, "GearOps items could not be loaded.");
  assert.equal(result.hint, "Check server logs for diagnostic code GEAROPS_ITEMS_LOAD_FAILED.");

  mutableEnv.NODE_ENV = previous;
});
