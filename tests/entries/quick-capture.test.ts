import assert from "node:assert/strict";
import test from "node:test";

import {
  inferQuickCaptureContextFromPath,
  normalizeQuickCapturePriority,
  resolveQuickCaptureDueDate,
  resolveQuickCaptureEntryType,
} from "../../lib/quick-capture";

test("resolveQuickCaptureEntryType always resolves to task for quick capture", () => {
  const result = resolveQuickCaptureEntryType();

  assert.equal(result, "TASK");
});

test("resolveQuickCaptureEntryType ignores legacy and inferred entry type values", () => {
  const result = resolveQuickCaptureEntryType();

  assert.equal(result, "TASK");
});

test("resolveQuickCaptureDueDate resolves shortcuts in UTC", () => {
  const now = new Date("2026-05-26T18:00:00.000Z");

  assert.equal(resolveQuickCaptureDueDate("TODAY", now)?.toISOString(), "2026-05-26T00:00:00.000Z");
  assert.equal(resolveQuickCaptureDueDate("TOMORROW", now)?.toISOString(), "2026-05-27T00:00:00.000Z");
  assert.equal(resolveQuickCaptureDueDate("NEXT_WEEK", now)?.toISOString(), "2026-06-02T00:00:00.000Z");
});

test("normalizeQuickCapturePriority falls back when invalid", () => {
  assert.equal(normalizeQuickCapturePriority("HIGH", "MEDIUM"), "HIGH");
  assert.equal(normalizeQuickCapturePriority("invalid", "MEDIUM"), "MEDIUM");
});

test("inferQuickCaptureContextFromPath maps team, event, and gear item paths", () => {
  assert.deepEqual(inferQuickCaptureContextFromPath("/teams/team_123"), {
    targetType: "TEAM",
    targetId: "team_123",
    label: "Team context auto-linked",
  });

  assert.deepEqual(inferQuickCaptureContextFromPath("/events/event_123"), {
    targetType: "EVENT",
    targetId: "event_123",
    label: "Event context auto-linked",
  });

  assert.deepEqual(inferQuickCaptureContextFromPath("/gear-ops/items/gear_123"), {
    targetType: "GEAR_ITEM",
    targetId: "gear_123",
    label: "Gear item context auto-linked",
  });
});
