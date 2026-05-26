import { strict as assert } from "node:assert";
import test from "node:test";

import {
  buildDigestWindow,
  buildNotificationAggregateKey,
  determineLiveDueState,
  labelForDeliveryTiming,
  labelForNotificationCategory,
  maxNotificationPriority,
  meetsNotificationPriorityThreshold,
  notificationPreferenceFieldForCategory,
} from "../../lib/notifications/types";

test("buildNotificationAggregateKey composes stable category keys", () => {
  assert.equal(
    buildNotificationAggregateKey({ category: "WORKFLOW", subjectId: "run-1", secondaryId: "step-2" }),
    "workflow:run-1:step-2",
  );
});

test("meetsNotificationPriorityThreshold honors minimum priority", () => {
  assert.equal(meetsNotificationPriorityThreshold("HIGH", "MEDIUM"), true);
  assert.equal(meetsNotificationPriorityThreshold("LOW", "MEDIUM"), false);
});

test("maxNotificationPriority keeps the higher urgency", () => {
  assert.equal(maxNotificationPriority("LOW", "URGENT"), "URGENT");
  assert.equal(maxNotificationPriority("HIGH", "MEDIUM"), "HIGH");
});

test("buildDigestWindow snaps to the configured hour window", () => {
  const now = new Date("2026-05-26T10:32:00.000Z");
  const window = buildDigestWindow(now, 6);

  assert.equal(window.windowStartsAt.toISOString(), "2026-05-26T06:00:00.000Z");
  assert.equal(window.windowEndsAt.toISOString(), "2026-05-26T12:00:00.000Z");
  assert.equal(window.digestWindowHours, 6);
});

test("determineLiveDueState returns overdue for past due dates", () => {
  const now = new Date("2026-05-26T10:00:00.000Z");
  const dueDate = new Date("2026-05-25T00:00:00.000Z");

  assert.equal(determineLiveDueState(dueDate, now), "OVERDUE");
});

test("determineLiveDueState returns due soon for near-term due dates", () => {
  const now = new Date("2026-05-26T10:00:00.000Z");
  const dueDate = new Date("2026-05-27T00:00:00.000Z");

  assert.equal(determineLiveDueState(dueDate, now), "DUE_SOON");
});

test("determineLiveDueState returns none for distant due dates", () => {
  const now = new Date("2026-05-26T10:00:00.000Z");
  const dueDate = new Date("2026-06-02T00:00:00.000Z");

  assert.equal(determineLiveDueState(dueDate, now), "NONE");
});

test("notificationPreferenceFieldForCategory maps categories to toggle fields", () => {
  assert.equal(notificationPreferenceFieldForCategory("ASSIGNMENT"), "assignmentEnabled");
  assert.equal(notificationPreferenceFieldForCategory("LINKED_ISSUE"), "linkedIssueEnabled");
});

test("notification labels remain human readable", () => {
  assert.equal(labelForNotificationCategory("FOLLOW_UP"), "Follow-up");
  assert.equal(labelForDeliveryTiming("DIGEST_ONLY"), "Digest-first");
});
