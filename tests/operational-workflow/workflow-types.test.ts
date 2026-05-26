import { strict as assert } from "node:assert";
import test from "node:test";

import type { EntryType } from "@prisma/client";

import {
  computeStepDueDate,
  parseWorkflowSteps,
  serializeWorkflowSteps,
  validateWorkflowSteps,
} from "../../lib/operational-workflow/types";
import type { WorkflowStepDefinition } from "../../lib/operational-workflow/types";

// ── parseWorkflowSteps ──────────────────────────────────────────────────────

test("parseWorkflowSteps returns an array of step definitions from valid JSON", () => {
  const steps: WorkflowStepDefinition[] = [
    { stepIndex: 0, title: "Coach follow-up", entryType: "FOLLOW_UP" as EntryType },
    { stepIndex: 1, title: "Parent contact", entryType: "FOLLOW_UP" as EntryType },
  ];
  const json = JSON.stringify(steps);
  const parsed = parseWorkflowSteps(json);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].title, "Coach follow-up");
  assert.equal(parsed[1].stepIndex, 1);
});

test("parseWorkflowSteps returns empty array for invalid JSON", () => {
  assert.deepEqual(parseWorkflowSteps("not json"), []);
});

test("parseWorkflowSteps returns empty array for non-array JSON", () => {
  assert.deepEqual(parseWorkflowSteps(JSON.stringify({ a: 1 })), []);
});

test("parseWorkflowSteps returns empty array for empty JSON array", () => {
  assert.deepEqual(parseWorkflowSteps("[]"), []);
});

// ── serializeWorkflowSteps ──────────────────────────────────────────────────

test("serializeWorkflowSteps sorts steps by stepIndex before serializing", () => {
  const steps: WorkflowStepDefinition[] = [
    { stepIndex: 2, title: "Step C", entryType: "TASK" as EntryType },
    { stepIndex: 0, title: "Step A", entryType: "FOLLOW_UP" as EntryType },
    { stepIndex: 1, title: "Step B", entryType: "READINESS_ITEM" as EntryType },
  ];
  const json = serializeWorkflowSteps(steps);
  const parsed = JSON.parse(json) as WorkflowStepDefinition[];
  assert.equal(parsed[0].stepIndex, 0);
  assert.equal(parsed[1].stepIndex, 1);
  assert.equal(parsed[2].stepIndex, 2);
});

test("serializeWorkflowSteps round-trips through parseWorkflowSteps", () => {
  const steps: WorkflowStepDefinition[] = [
    { stepIndex: 0, title: "Readiness check", entryType: "READINESS_ITEM" as EntryType, dueDaysOffset: 3 },
    { stepIndex: 1, title: "Review session", entryType: "FOLLOW_UP" as EntryType, inheritAssignment: true },
  ];
  const json = serializeWorkflowSteps(steps);
  const parsed = parseWorkflowSteps(json);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].dueDaysOffset, 3);
  assert.equal(parsed[1].inheritAssignment, true);
});

// ── validateWorkflowSteps ───────────────────────────────────────────────────

test("validateWorkflowSteps returns valid for a well-formed step array", () => {
  const steps: WorkflowStepDefinition[] = [
    { stepIndex: 0, title: "First step", entryType: "FOLLOW_UP" as EntryType },
    { stepIndex: 1, title: "Second step", entryType: "TASK" as EntryType },
  ];
  const result = validateWorkflowSteps(steps);
  assert.equal(result.valid, true);
});

test("validateWorkflowSteps rejects empty step array", () => {
  const result = validateWorkflowSteps([]);
  assert.equal(result.valid, false);
  assert.match(result.message, /at least one step/);
});

test("validateWorkflowSteps rejects non-contiguous step indices", () => {
  const steps: WorkflowStepDefinition[] = [
    { stepIndex: 0, title: "First", entryType: "TASK" as EntryType },
    { stepIndex: 2, title: "Third", entryType: "TASK" as EntryType },
  ];
  const result = validateWorkflowSteps(steps);
  assert.equal(result.valid, false);
  assert.match(result.message, /gap at index 1/);
});

test("validateWorkflowSteps rejects a step with an empty title", () => {
  const steps: WorkflowStepDefinition[] = [
    { stepIndex: 0, title: "", entryType: "TASK" as EntryType },
  ];
  const result = validateWorkflowSteps(steps);
  assert.equal(result.valid, false);
  assert.match(result.message, /non-empty title/);
});

test("validateWorkflowSteps accepts steps provided in any order (sorts by index)", () => {
  const steps: WorkflowStepDefinition[] = [
    { stepIndex: 1, title: "Second", entryType: "TASK" as EntryType },
    { stepIndex: 0, title: "First", entryType: "FOLLOW_UP" as EntryType },
  ];
  const result = validateWorkflowSteps(steps);
  assert.equal(result.valid, true);
});

// ── computeStepDueDate ──────────────────────────────────────────────────────

test("computeStepDueDate returns null when offset is undefined", () => {
  const start = new Date("2026-06-01T12:00:00.000Z");
  assert.equal(computeStepDueDate(start, undefined), null);
});

test("computeStepDueDate returns null when offset is zero", () => {
  const start = new Date("2026-06-01T12:00:00.000Z");
  assert.equal(computeStepDueDate(start, 0), null);
});

test("computeStepDueDate returns midnight UTC N days after start", () => {
  const start = new Date("2026-06-01T12:00:00.000Z");
  const due = computeStepDueDate(start, 3);
  assert.ok(due !== null);
  assert.equal(due!.toISOString(), "2026-06-04T00:00:00.000Z");
});

test("computeStepDueDate handles month boundary correctly", () => {
  const start = new Date("2026-01-30T00:00:00.000Z");
  const due = computeStepDueDate(start, 5);
  assert.ok(due !== null);
  assert.equal(due!.toISOString(), "2026-02-04T00:00:00.000Z");
});

test("computeStepDueDate returns null for negative offset", () => {
  const start = new Date("2026-06-01T12:00:00.000Z");
  assert.equal(computeStepDueDate(start, -1), null);
});
