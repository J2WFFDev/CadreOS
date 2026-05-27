import { strict as assert } from "node:assert";
import test from "node:test";

import { Prisma } from "@prisma/client";

import { describeSchemaUnavailableError, isSchemaUnavailableError } from "../../lib/workflows";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePrismaKnownRequestError(
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("test error", {
    code,
    clientVersion: "0.0.0",
    meta,
  });
}

// ---------------------------------------------------------------------------
// isSchemaUnavailableError
// ---------------------------------------------------------------------------

test("isSchemaUnavailableError returns true for P2021 (table not found)", () => {
  const error = makePrismaKnownRequestError("P2021", { table: "GearReservation" });
  assert.equal(isSchemaUnavailableError(error), true);
});

test("isSchemaUnavailableError returns true for P2022 (column not found)", () => {
  const error = makePrismaKnownRequestError("P2022", { column: "GearItem.inspectionDueStatus" });
  assert.equal(isSchemaUnavailableError(error), true);
});

test("isSchemaUnavailableError returns false for unrelated Prisma error codes", () => {
  const error = makePrismaKnownRequestError("P2025"); // record not found
  assert.equal(isSchemaUnavailableError(error), false);
});

test("isSchemaUnavailableError returns false for plain Error", () => {
  assert.equal(isSchemaUnavailableError(new Error("something went wrong")), false);
});

test("isSchemaUnavailableError returns false for null", () => {
  assert.equal(isSchemaUnavailableError(null), false);
});

test("isSchemaUnavailableError returns false for undefined", () => {
  assert.equal(isSchemaUnavailableError(undefined), false);
});

// ---------------------------------------------------------------------------
// describeSchemaUnavailableError
// ---------------------------------------------------------------------------

test("describeSchemaUnavailableError returns table name for P2021 with meta.table", () => {
  const error = makePrismaKnownRequestError("P2021", { table: "GearReservation" });
  assert.equal(describeSchemaUnavailableError(error), 'table "GearReservation" is missing');
});

test("describeSchemaUnavailableError returns generic description for P2021 without meta.table", () => {
  const error = makePrismaKnownRequestError("P2021");
  assert.equal(describeSchemaUnavailableError(error), "a required table is missing");
});

test("describeSchemaUnavailableError returns column name for P2022 with meta.column", () => {
  const error = makePrismaKnownRequestError("P2022", { column: "GearItem.inspectionDueStatus" });
  assert.equal(describeSchemaUnavailableError(error), 'column "GearItem.inspectionDueStatus" is missing');
});

test("describeSchemaUnavailableError returns generic description for P2022 without meta.column", () => {
  const error = makePrismaKnownRequestError("P2022");
  assert.equal(describeSchemaUnavailableError(error), "a required column is missing");
});

test("describeSchemaUnavailableError returns null for non-schema-unavailable Prisma error", () => {
  const error = makePrismaKnownRequestError("P2025");
  assert.equal(describeSchemaUnavailableError(error), null);
});

test("describeSchemaUnavailableError returns null for plain Error", () => {
  assert.equal(describeSchemaUnavailableError(new Error("generic")), null);
});

test("describeSchemaUnavailableError returns null for null", () => {
  assert.equal(describeSchemaUnavailableError(null), null);
});